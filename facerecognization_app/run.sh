#!/bin/bash

# Elegant console header
echo -e "\033[1;35m============================================================\033[0m"
echo -e "\033[1;36m       BioSecurity Face Recognition Visitor System          \033[0m"
echo -e "\033[1;35m============================================================\033[0m"
echo -e "\033[1;32m[System] Activating virtual environment...\033[0m"

if [ ! -d "venv" ]; then
    echo -e "\033[1;31m[Error] Python virtual environment (venv) not found!\033[0m"
    echo -e "\033[1;33mCreating venv and installing requirements...\033[0m"
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

echo -e "\033[1;32m[System] Launching FastAPI Web Service on http://localhost:8000 ...\033[0m"
echo -e "\033[1;33m[Info] Note: SFace and YuNet models will be verified/downloaded on startup.\033[0m"
echo -e "\033[1;35m------------------------------------------------------------\033[0m"

# Run FastAPI app using Uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
