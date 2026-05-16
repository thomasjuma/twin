import os
from dotenv import load_dotenv
import uuid
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import OpenAI

from models import ChatRequest
from context import prompt
from storage import USE_S3, load_conversation, save_conversation


# Load environment variables
load_dotenv()

OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-5.5")

app = FastAPI()
client = OpenAI()

# Configure CORS
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Session-Id"],
)


@app.get("/")
async def root():
    return {
        "message": "AI Digital Twin API (Powered by OpenAI)",
        "memory_enabled": True,
        "storage": "S3" if USE_S3 else "local",
        "ai_model": OPENAI_CHAT_MODEL,
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "use_s3": USE_S3,
        "ai_model": OPENAI_CHAT_MODEL,
    }


@app.post("/chat")
async def chat(request: ChatRequest):
    # Generate session ID if not provided
    session_id = request.session_id or str(uuid.uuid4())
    try:
        # Load conversation history
        conversation = load_conversation(session_id)

        # Build messages for OpenAI
        messages = [{"role": "system", "content": prompt()}]

        # Add conversation history (keep last 20 messages for context window)
        for msg in conversation[-20:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

        # Add current user message
        messages.append({"role": "user", "content": request.message})

        user_message = {
            "role": "user",
            "content": request.message,
            "timestamp": datetime.now().isoformat(),
        }
        conversation.append(user_message)

        # Call OpenAI API
        stream = client.chat.completions.create(
            model=OPENAI_CHAT_MODEL, 
            messages=messages,
            stream=True
        )

        assistant_response_parts = []
        async def event_stream():
            for chunk in stream:
                text = chunk.choices[0].delta.content
                if text:
                    assistant_response_parts.append(text)
                    yield text

            assistant_response = "".join(assistant_response_parts)

            # Update conversation history after the stream has completed.
            conversation.append(
                {"role": "user", "content": request.message, "timestamp": datetime.now().isoformat()}
            )
            conversation.append(
                {
                    "role": "assistant",
                    "content": assistant_response,
                    "timestamp": datetime.now().isoformat(),
                }
            )

            # Save conversation
            save_conversation(session_id, conversation)

        return StreamingResponse(
            event_stream(),
            headers={"X-Session-Id": session_id},
            media_type="text/plain",
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/conversation/{session_id}")
async def get_conversation(session_id: str):
    """Retrieve conversation history"""
    try:
        conversation = load_conversation(session_id)
        return {"session_id": session_id, "messages": conversation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
