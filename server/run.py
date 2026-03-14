import sys
import os
from dotenv import load_dotenv
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()
from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
