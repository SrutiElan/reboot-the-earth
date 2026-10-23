# Backend

FastAPI service for Reboot the Earth.

## Run locally

From this directory, create and activate a virtual environment, then install the dependencies:

```bash
python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

Start the development server:

```bash
uvicorn main:app --reload
```

The API is available at `http://localhost:8000`. Interactive documentation is available at `/docs`, and the health check is available at `/health`.
