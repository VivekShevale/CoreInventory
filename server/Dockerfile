# Stage 1: Python backend
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies required by PostgreSQL driver
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . .

EXPOSE 5000

# Run Flask using Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "run:app"]