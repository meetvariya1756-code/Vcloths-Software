import os
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from parser import extract_sales_from_pdf

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = './temp_uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        "status": "online",
        "service": "SalesFlow PDF Parser Microservice",
        "endpoints": {
            "/parse": "POST - Upload and parse PDF file"
        }
    }), 200

@app.route('/parse', methods=['POST'])
def parse_pdf():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
        
    if file:
        filename = secure_filename(file.filename)
        unique_id = uuid.uuid4().hex
        temp_filename = f"{unique_id}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)
        file.save(filepath)
        
        try:
            records = extract_sales_from_pdf(filepath, original_filename=file.filename)
            # Remove temp file
            if os.path.exists(filepath):
                os.remove(filepath)
            return jsonify({"filename": filename, "records": records})
        except Exception as e:
            if os.path.exists(filepath):
                os.remove(filepath)
            return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Run on host 0.0.0.0 and port from environment variable for production
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)

