import os
import re
import json
import logging
from typing import List, Optional
from io import BytesIO
from pypdf import PdfReader
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pymongo import MongoClient
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from root
load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fastapi-service")

app = FastAPI(title="AI Support Agent Intelligence Service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
VECTOR_INDEX_NAME = "vector_index"
DB_NAME = "support_agent"
COLLECTION_NAME = "document_chunks"

def get_mongodb_client():
    mongo_uri = os.environ.get("MONGODB_URI")
    if not mongo_uri:
        logger.warning("MONGODB_URI env var not set. Vector storage will not work.")
        return None
    return MongoClient(mongo_uri)

def get_llm_provider():
    if os.environ.get("OPENAI_API_KEY"):
        return "openai"
    else:
        return None

def generate_embedding(text: str) -> List[float]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="No OpenAI API Key configured. Please set OPENAI_API_KEY.")
    
    try:
        client = OpenAI(api_key=api_key)
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding error: {str(e)}")

def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="No OpenAI API Key configured. Please set OPENAI_API_KEY.")
    
    try:
        client = OpenAI(api_key=api_key)
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=texts
        )
        return [item.embedding for item in response.data]
    except Exception as e:
        logger.error(f"Error generating batch embeddings: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding error: {str(e)}")

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> List[str]:
    # Basic robust chunking
    words = text.split()
    chunks = []
    
    if len(words) == 0:
        return []
        
    # Reconstruct chunks based on character length roughly, or word count
    # Let's chunk by sentences or lines for better semantic meaning
    sentences = re.split(r'(?<=[.!?])\s+', text)
    current_chunk = ""
    
    for sentence in sentences:
        if len(current_chunk) + len(sentence) < chunk_size:
            current_chunk += sentence + " "
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            # Overlap handling (take last 2 words/sentences, or just slide)
            current_chunk = sentence + " "
            
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
        
    return chunks

class QueryRequest(BaseModel):
    query: str
    history: Optional[List[dict]] = []

class SummarizeRequest(BaseModel):
    text: str

@app.post("/api/summarize")
async def summarize_title(request: SummarizeRequest):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"title": request.text[:30]}
    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Summarize the user query into a short 3-4 word title for a support chat. Do not use quotes or punctuation. Example: 'Database setup issue' or 'Ingestion manual guide'. Return ONLY the title."},
                {"role": "user", "content": request.text}
            ],
            max_tokens=15
        )
        title = response.choices[0].message.content.strip()
        return {"title": title}
    except Exception as e:
        logger.error(f"Error summarizing title: {e}")
        return {"title": request.text[:30]}

@app.get("/api/health")
def health_check():
    provider = get_llm_provider()
    mongo_status = "Connected" if get_mongodb_client() is not None else "Disconnected"
    return {
        "status": "healthy",
        "provider": provider,
        "mongodb": mongo_status
    }

@app.post("/api/ingest")
async def ingest_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None)
):
    client = get_mongodb_client()
    if not client:
        raise HTTPException(status_code=500, detail="MongoDB connection is not configured.")
        
    filename = file.filename or ""
    # Read text or PDF content
    try:
        content = await file.read()
        if filename.lower().endswith(".pdf"):
            pdf_file = BytesIO(content)
            reader = PdfReader(pdf_file)
            text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        else:
            text = content.decode("utf-8", errors="ignore")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read or parse file: {e}")
        
    doc_title = title or filename or "Untitled Document"
    chunks = chunk_text(text)
    
    if not chunks:
        return {"success": True, "message": "File was empty, no chunks created.", "chunks_created": 0}
        
    try:
        # Batch generate embeddings for all chunks in a single call to optimize performance
        embeddings = generate_embeddings_batch(chunks)
    except Exception as e:
        logger.error(f"Failed to generate batch embeddings: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")
        
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    
    docs_to_insert = []
    for idx, chunk in enumerate(chunks):
        docs_to_insert.append({
            "title": doc_title,
            "chunk_index": idx,
            "text": chunk,
            "embedding": embeddings[idx]
        })
        
    if docs_to_insert:
        collection.insert_many(docs_to_insert)
        
    return {
        "success": True,
        "message": f"Successfully ingested {doc_title}",
        "chunks_created": len(docs_to_insert)
    }

@app.post("/api/chat/stream")
async def chat_stream(request: QueryRequest):
    client = get_mongodb_client()
    if not client:
        raise HTTPException(status_code=500, detail="MongoDB connection is not configured.")
        
    # Detect greetings and introductory queries
    normalized_q = request.query.lower().strip().replace("?", "").replace("!", "")
    is_greeting = normalized_q in [
        "hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening",
        "who are you", "what is your name", "what do you do", "introduce yourself", "how can you help"
    ] or any(greet in normalized_q for greet in ["say hello", "hello odin", "hi odin", "hey odin"])

    context_list = []
    sources = []

    if not is_greeting:
        # 1. Generate query embedding
        query_emb = generate_embedding(request.query)
        
        # 2. Vector search in MongoDB
        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]
        
        # Check if index exists or runs Vector Search
        # Note: Mongo Atlas Vector Search uses `$vectorSearch` aggregation stage
        pipeline = [
            {
                "$vectorSearch": {
                    "index": VECTOR_INDEX_NAME,
                    "path": "embedding",
                    "queryVector": query_emb,
                    "numCandidates": 100,
                    "limit": 6
                }
            },
            {
                "$project": {
                    "title": 1,
                    "text": 1,
                    "score": {"$meta": "vectorSearchScore"}
                }
            }
        ]
        
        try:
            cursor = collection.aggregate(pipeline)
            for doc in cursor:
                context_list.append(f"Source Document: {doc['title']}\nContent: {doc['text']}")
                if doc["title"] not in sources:
                    sources.append(doc["title"])
        except Exception as e:
            logger.warning(f"Vector search failed or index is not set up yet. Falling back to regex search: {e}")
            
            # Robust case-insensitive fallback keyword-based regex matching
            try:
                keywords = [w for w in re.split(r'\W+', request.query) if len(w) > 3]
                if keywords:
                    regex_pattern = "|".join(keywords)
                    cursor = collection.find({"text": {"$regex": regex_pattern, "$options": "i"}}).limit(6)
                else:
                    cursor = collection.find({"text": {"$regex": request.query, "$options": "i"}}).limit(6)
                    
                for doc in cursor:
                    context_list.append(f"Source Document: {doc['title']}\nContent: {doc['text']}")
                    if doc["title"] not in sources:
                        sources.append(doc["title"])
            except Exception as err_regex:
                logger.error(f"Regex fallback query failed: {err_regex}")
                # Final fallback: simple find limit 6
                try:
                    cursor = collection.find().limit(6)
                    for doc in cursor:
                        context_list.append(f"Source Document: {doc['title']}\nContent: {doc['text']}")
                        if doc["title"] not in sources:
                            sources.append(doc["title"])
                except Exception:
                    pass

    context_text = "\n\n".join(context_list) if context_list else "No relevant documentation found."
    
    # Strict prompt layout with friendly bypass for greetings/introductions
    system_prompt = (
        "You are Odin, a friendly AI Support Agent designed to help users with their questions.\n"
        "Instructions:\n"
        "1. If the user's message is a greeting (e.g., 'hi', 'hello', 'hey', 'greetings'), or asks who you are / what your name is / what you do / how you can help, respond warmly, engage politely, introduce yourself as Odin, and ask how you can help them today. Do NOT use the strict 'I cannot find the answer' fallback for these greetings/introductions.\n"
        "2. For factual or support queries about documentation/company details: answer comprehensively based on the provided Context. Do not be overly literal; if a detail is related to the query, include it.\n"
        "3. If the answer to a support/factual query is not in the provided Context, reply exactly with: \"I cannot find the answer in the provided documentation.\"\n"
        "4. Do not make up facts or use external knowledge for factual support questions.\n"
        "5. You MUST append at the very end of your response a new line containing exactly: \"Sources Used: [Title1, Title2]\" where Title1, Title2, etc. are the exact titles of the Source Documents from the Context that you actually got the information from to construct your answer. For example, if you only got information from 'Amit_FullStack_3June', write \"Sources Used: [Amit_FullStack_3June]\". If you did not find the answer in the Context, do not append this line.\n\n"
        f"Context:\n{context_text}"
    )
    
    api_key = os.environ.get("OPENAI_API_KEY")
    
    async def stream_generator():
        # Yield metadata first: relevant sources
        yield f"event: sources\ndata: {json.dumps(sources)}\n\n"
        
        if not api_key:
            yield f"event: error\ndata: {json.dumps('No OpenAI API Key found. Set OPENAI_API_KEY.')}\n\n"
            yield "event: end\ndata: [DONE]\n\n"
            return

        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key)
            messages = [{"role": "system", "content": system_prompt}]
            for msg in (request.history or []):
                messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
            messages.append({"role": "user", "content": request.query})
            
            completion = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                stream=True
            )
            
            complete_response_text = ""
            async for chunk in completion:
                delta = chunk.choices[0].delta
                if hasattr(delta, "content") and delta.content:
                    complete_response_text += delta.content
                    yield f"event: message\ndata: {json.dumps(delta.content)}\n\n"
            
            # Post-generation sources filter based on word overlap
            import re
            filtered_sources = []
            clean_completion = re.sub(r'Sources Used:\s*\[.*?\]', '', complete_response_text, flags=re.IGNORECASE).strip()
            
            # If it's a fallback message, empty, or greeting, clear sources entirely
            has_greeting_keywords = any(k in clean_completion.lower() for k in ["odin", "hello", "greetings", "hi there", "how can i help", "how can i assist"])
            if is_greeting or not clean_completion or "I cannot find the answer" in clean_completion or has_greeting_keywords:
                filtered_sources = []
            else:
                response_words = set(w.lower() for w in re.split(r'\W+', clean_completion) if len(w) > 3)
                for title in sources:
                    # Collect retrieved text content for this title to check overlap
                    prefix = f"Source Document: {title}\nContent: "
                    doc_texts = [chunk.split('\nContent: ', 1)[1] for chunk in context_list if chunk.startswith(prefix)]
                    if not doc_texts:
                        doc_texts = [chunk for chunk in context_list if title in chunk]
                    
                    doc_text = " ".join(doc_texts)
                    doc_words = set(w.lower() for w in re.split(r'\W+', doc_text) if len(w) > 3)
                    overlap = response_words.intersection(doc_words)
                    # If there's a significant overlap (at least 3 words), include this source
                    if len(overlap) >= 3:
                        filtered_sources.append(title)
                
                # Fallback: if overlap filter cleared everything but there was a response, keep the primary source
                if not filtered_sources and sources:
                    filtered_sources = [sources[0]]
            
            yield f"event: sources\ndata: {json.dumps(filtered_sources)}\n\n"
            
        except Exception as e:
            logger.error(f"OpenAI generation error: {e}")
            yield f"event: error\ndata: {json.dumps(str(e))}\n\n"
            
        yield "event: end\ndata: [DONE]\n\n"

    headers = {
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    }
    return StreamingResponse(stream_generator(), media_type="text/event-stream", headers=headers)

@app.get("/api/documents")
def list_documents():
    client = get_mongodb_client()
    if not client:
        raise HTTPException(status_code=500, detail="MongoDB connection is not configured.")
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    try:
        titles = collection.distinct("title")
        return {"documents": [{"title": title} for title in titles]}
    except Exception as e:
        logger.error(f"Error listing documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/documents/{title:path}")
def delete_document(title: str):
    client = get_mongodb_client()
    if not client:
        raise HTTPException(status_code=500, detail="MongoDB connection is not configured.")
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    try:
        result = collection.delete_many({"title": title})
        return {"success": True, "deleted_count": result.deleted_count}
    except Exception as e:
        logger.error(f"Error deleting document {title}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
