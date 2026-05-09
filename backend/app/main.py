from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.graph import compiled_graph

app = FastAPI(title="Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/health")
async def health():
    return {"status": "ok"}


class GraphRequest(BaseModel):
    text: str = ""


@app.post("/graph/invoke")
async def graph_invoke(req: GraphRequest):
    result = await compiled_graph.ainvoke({"text": req.text})
    return result
