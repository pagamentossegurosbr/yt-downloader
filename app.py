import os
from flask import Flask, request, send_file, jsonify, after_this_request
import yt_dlp
import uuid
from threading import Lock

# Garante que o ffmpeg está no PATH
os.environ["PATH"] += os.pathsep + r"C:\\Users\\isaqu\\Downloads\\ffmpeg-2025-07-10-git-82aeee3c19-full_build\\ffmpeg-2025-07-10-git-82aeee3c19-full_build\\bin"

app = Flask(__name__)

DOWNLOAD_DIR = "downloads"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# Progresso em memória (simples, por sessão)
download_progress = {}
progress_lock = Lock()

# Rotas para servir o frontend
@app.route('/')
def home():
    return send_file('index.html')

@app.route('/style.css')
def style():
    return send_file('style.css')

@app.route('/main.js')
def mainjs():
    return send_file('main.js')

@app.route('/logo-notch.png')
def logo():
    return send_file('logo-notch.png')

# Rota para obter informações do vídeo e qualidades disponíveis
@app.route('/info', methods=['POST'])
def video_info():
    data = request.json
    url = data.get('url')
    if not url:
        return jsonify({'error': 'URL não fornecida'}), 400
    try:
        ydl_opts = {'quiet': True, 'no_warnings': True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            formats = info.get('formats', [])
            # Filtrar formatos de vídeo e áudio
            qualities = []
            for f in formats:
                if f.get('vcodec') != 'none' and f.get('acodec') != 'none':
                    label = f"{f.get('format_note', '')} {f.get('height', '')}p".strip()
                    qualities.append({
                        'format_id': f['format_id'],
                        'ext': f['ext'],
                        'label': label,
                        'filesize': f.get('filesize')
                    })
                elif f.get('vcodec') == 'none' and f.get('acodec') != 'none':
                    qualities.append({
                        'format_id': f['format_id'],
                        'ext': f['ext'],
                        'label': 'Apenas Áudio',
                        'filesize': f.get('filesize')
                    })
            # Remover duplicatas
            seen = set()
            unique_qualities = []
            for q in qualities:
                key = (q['format_id'], q['label'])
                if key not in seen:
                    unique_qualities.append(q)
                    seen.add(key)
            return jsonify({
                'title': info.get('title'),
                'duration': info.get('duration'),
                'thumbnail': info.get('thumbnail'),
                'uploader': info.get('uploader'),
                'qualities': unique_qualities
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Rota de download com qualidade e progresso
@app.route('/download', methods=['POST'])
def download_video():
    data = request.json
    url = data.get('url')
    format_id = data.get('format_id')
    download_id = data.get('download_id') or str(uuid.uuid4())
    if not url:
        return jsonify({'error': 'URL não fornecida'}), 400

    output_path = os.path.join(DOWNLOAD_DIR, f"{download_id}.mp4")
    ydl_opts = {
        'outtmpl': output_path,
        'merge_output_format': 'mp4',
        'quiet': True,
    }
    # Se for 'best', use o formato yt-dlp para máxima qualidade real
    if format_id == 'best' or not format_id:
        ydl_opts['format'] = 'bestvideo+bestaudio/best'
    else:
        ydl_opts['format'] = format_id

    def progress_hook(d):
        with progress_lock:
            if d['status'] == 'downloading':
                total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
                downloaded = d.get('downloaded_bytes', 0)
                percent = int((downloaded / total) * 100) if total else 0
                download_progress[download_id] = percent
            elif d['status'] == 'finished':
                download_progress[download_id] = 100

    ydl_opts['progress_hooks'] = [progress_hook]

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        @after_this_request
        def remove_file(response):
            try:
                os.remove(output_path)
            except Exception as e:
                print(f"Erro ao remover arquivo: {e}")
            with progress_lock:
                download_progress.pop(download_id, None)
            return response

        return send_file(output_path, as_attachment=True, download_name="video.mp4", max_age=0)
    except Exception as e:
        with progress_lock:
            download_progress.pop(download_id, None)
        return jsonify({'error': str(e)}), 500

# Rota para consultar progresso
@app.route('/progress/<download_id>')
def get_progress(download_id):
    with progress_lock:
        percent = download_progress.get(download_id, 0)
    return jsonify({'progress': percent})

if __name__ == '__main__':
    app.run(debug=True)