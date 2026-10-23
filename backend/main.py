from fastapi import FastAPI
from pydantic import BaseModel


app = FastAPI(
    title="Reboot the Earth API",
    version="0.1.0",
)


class HealthResponse(BaseModel):
    status: str
    service: str


@app.get("/", tags=["default"])
async def root() -> dict[str, str]:
    return {"message": "Reboot the Earth API"}


@app.get("/health", response_model=HealthResponse, tags=["default"])
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="reboot-the-earth-backend")
