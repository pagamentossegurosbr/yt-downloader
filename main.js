document.addEventListener('DOMContentLoaded', function () {
    const form = document.querySelector('.download-form');
    const btnDownload = document.querySelector('.btn-download');
    const btnInfo = document.querySelector('.btn-info');
    const input = document.querySelector('.input-url');
    const videoInfo = document.querySelector('.video-info');
    const videoThumb = document.querySelector('.video-thumb');
    const videoTitle = document.querySelector('.video-title');
    const videoUploader = document.querySelector('.video-uploader');
    const videoDuration = document.querySelector('.video-duration');
    const qualitySelect = document.querySelector('.quality-select');
    const progressBarContainer = document.querySelector('.progress-bar-container');
    const progressBar = document.querySelector('.progress-bar');
    const progressLabel = document.querySelector('.progress-label');

    let progressInterval = null;
    let lastInfo = null;
    let infoTimeout = null;

    // Debounce para otimizar requisições
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function formatDuration(seconds) {
        if (!seconds) return '';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Feedback visual imediato
    function setButtonLoading(button, text, disabled = true) {
        button.disabled = disabled;
        button.innerHTML = text;
        button.style.opacity = disabled ? '0.7' : '1';
    }

    function setButtonNormal(button, text) {
        button.disabled = false;
        button.innerHTML = text;
        button.style.opacity = '1';
    }

    // Validação rápida de URL
    function isValidYouTubeUrl(url) {
        const patterns = [
            /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/,
            /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=.+/,
            /^(https?:\/\/)?youtu\.be\/.+/
        ];
        return patterns.some(pattern => pattern.test(url));
    }

    // Processamento otimizado de informações
    const processVideoInfo = debounce(async function() {
        const url = input.value.trim();
        if (!url || !isValidYouTubeUrl(url)) {
            videoInfo.style.display = 'none';
            return;
        }

        setButtonLoading(btnInfo, '<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 2v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Carregando...');
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

            const res = await fetch('/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            lastInfo = data;
            
            // Atualização otimizada do DOM
            requestAnimationFrame(() => {
                videoTitle.textContent = data.title || '';
                videoUploader.textContent = data.uploader ? `Canal: ${data.uploader}` : '';
                videoDuration.textContent = data.duration ? `Duração: ${formatDuration(data.duration)}` : '';
                
                if (data.thumbnail) {
                    videoThumb.src = data.thumbnail;
                    videoThumb.style.display = '';
                } else {
                    videoThumb.style.display = 'none';
                }

                // Populate quality select efficiently
                qualitySelect.innerHTML = '';
                const optBest = document.createElement('option');
                optBest.value = 'best';
                optBest.textContent = 'Qualidade máxima (Vídeo+Áudio)';
                qualitySelect.appendChild(optBest);

                (data.qualities || []).forEach(q => {
                    const label = q.label ? `${q.label} (${q.ext})` : q.ext;
                    const size = q.filesize ? ` - ${(q.filesize / 1024 / 1024).toFixed(1)}MB` : '';
                    const opt = document.createElement('option');
                    opt.value = q.format_id;
                    opt.textContent = label + size;
                    qualitySelect.appendChild(opt);
                });

                videoInfo.style.display = '';
                videoInfo.style.opacity = '0';
                setTimeout(() => {
                    videoInfo.style.opacity = '1';
                }, 10);
            });

        } catch (err) {
            console.error('Info error:', err);
            if (err.name === 'AbortError') {
                alert('Tempo limite excedido. Verifique sua conexão e tente novamente.');
            } else {
                alert('Erro ao obter informações: ' + err.message);
            }
            videoInfo.style.display = 'none';
        }

        setButtonNormal(btnInfo, '<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Ver informações');
    }, 300);

    // Event listeners otimizados
    btnInfo.addEventListener('click', processVideoInfo);

    // Auto-processamento quando usuário cola URL
    input.addEventListener('paste', function() {
        setTimeout(processVideoInfo, 100);
    });

    // Download otimizado
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const url = input.value.trim();
        if (!url || !isValidYouTubeUrl(url)) {
            alert('Por favor, cole um link válido do YouTube.');
            return;
        }

        let format_id = '';
        if (videoInfo.style.display !== 'none' && qualitySelect.value) {
            format_id = qualitySelect.value;
        }

        const download_id = uuidv4();
        setButtonLoading(btnDownload, '<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 2v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Baixando...');
        
        progressBarContainer.style.display = 'flex';
        progressBar.style.width = '0%';
        progressLabel.textContent = '0%';

        // Progress polling otimizado
        if (progressInterval) clearInterval(progressInterval);
        progressInterval = setInterval(async () => {
            try {
                const res = await fetch(`/progress/${download_id}`, {
                    signal: AbortSignal.timeout(5000) // 5s timeout
                });
                if (res.ok) {
                    const data = await res.json();
                    const percent = data.progress || 0;
                    progressBar.style.width = percent + '%';
                    progressLabel.textContent = percent + '%';
                }
            } catch (err) {
                console.warn('Progress check failed:', err);
            }
        }, 300); // Polling mais frequente para feedback mais suave

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000); // 5min timeout

            const res = await fetch('/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, format_id, download_id }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (res.ok && res.headers.get('content-type') && !res.headers.get('content-type').includes('application/json')) {
                // Download successful
                progressBar.style.width = '100%';
                progressLabel.textContent = '100%';
                
                const blob = await res.blob();
                const a = document.createElement('a');
                a.href = window.URL.createObjectURL(blob);
                a.download = 'video.mp4';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(a.href);
            } else {
                let err = {};
                try { err = await res.json(); } catch { err.error = 'Falha inesperada no download'; }
                throw new Error(err.error || 'Falha no download');
            }
        } catch (err) {
            console.error('Download error:', err);
            if (err.name === 'AbortError') {
                alert('Tempo limite excedido. O vídeo pode ser muito grande ou sua conexão está lenta.');
            } else {
                alert('Erro: ' + err.message);
            }
            progressBar.style.width = '0%';
            progressLabel.textContent = '0%';
        }

        setButtonNormal(btnDownload, '<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m0 0l-5-5m5 5l5-5"/></svg> Download');
        
        // Hide progress after delay
        setTimeout(() => {
            progressBarContainer.style.display = 'none';
        }, 1000);
        
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', function() {
        if (progressInterval) {
            clearInterval(progressInterval);
        }
        if (infoTimeout) {
            clearTimeout(infoTimeout);
        }
    });
});
