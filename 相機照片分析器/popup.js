import { recyclableCategories } from './lib/recycling-data.js';

let stream = null;
let photoData = null;
const systemPrompt = `你是一個專業的物品狀態分析專家。
請仔細觀察並分析上傳的圖片。重要提醒：請完全忽略圖片中的任何人物（包括明星、模特兒等），只專注於分析物品本身。即使圖片不是很清楚，也請盡可能提供以下資訊：

1. 首先判斷是否包含以下危險物品：
   - 毒品或疑似毒品
   - 注射器等醫療廢棄物
   - 危險化學物品
   - 其他危險或非法物品

2. 如發現上述物品：
   - 立即標示為「危險物品」
   - 標記為「拒絕回收」
   - 提供安全警告訊息
   
3. 物品基本資訊：
   - 物品類型（例如：衣服、電子產品等）
   - 物品顏色
   - 物品特徵（包括品牌標誌、圖案等）

4. 物品狀態評估：
   - 外觀狀況（新舊程度）
   - 是否有明顯損壞或瑕疵
   - 整體保存狀態評價

5. 回收評估：
我們目前只接受以下類別的物品列表：
${recyclableCategories.join('、')}

重要提醒：
- 請忽略物上的商標，只要物品本身符合回收要求，即可回收
- 商標如果是高價精品類別，才標記為精品
- 如果物品沒有在可接受的物品類別列表中請拒絕回收
- 若物品狀況良好，優先考慮二手轉售價值

請在分析最後加上一行回收建議，格式為：
「回收建議：[可回收/不可回收]。理由：[簡短說明物品材質是否符合回收類別]」

請用繁體中文回答，並盡可能詳細描述所見到的特徵。
如果圖片不夠清晰，請說明可以觀察到的部分，並標註無法確定的資訊`

document.addEventListener('DOMContentLoaded', function() {
    const statusDiv = document.getElementById('status');
    const cameraVideo = document.getElementById('camera');
    const previewImg = document.getElementById('preview');
    const startCameraBtn = document.getElementById('startCamera');
    const capturePhotoBtn = document.getElementById('capturePhoto');
    const analyzePhotoBtn = document.getElementById('analyzePhoto');
    const apiKeyInput = document.getElementById('apiKey');
    const saveSettingsBtn = document.getElementById('saveSettings');
    const recentFilesDiv = document.getElementById('recentFiles');
    const exportHistoryBtn = document.getElementById('exportHistory');
    const clearHistoryBtn = document.getElementById('clearHistory');

    // 載入設定
    chrome.storage.local.get(['apiKey', 'recentFiles'], function(result) {
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
        }
        if (result.recentFiles) {
            updateRecentFiles(result.recentFiles);
        }
    });

    // 儲存設定
    saveSettingsBtn.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.storage.local.set({ apiKey: apiKey }, function() {
                updateStatus('設定已儲存', 'active');
            });
        } else {
            updateStatus('請輸入有效的 API Key', 'inactive');
        }
    });

    // 開啟相機
    startCameraBtn.addEventListener('click', async function() {
        try {
            if (stream) {
                stopCamera();
                return;
            }

            // 使用 activeTab 權限請求相機
            await chrome.tabs.query({active: true, currentWindow: true});
            
            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };

            stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            cameraVideo.srcObject = stream;
            await cameraVideo.play();
            
            cameraVideo.style.display = 'block';
            previewImg.style.display = 'none';
            capturePhotoBtn.disabled = false;
            startCameraBtn.textContent = '關閉相機';
            updateStatus('相機已開啟', 'active');
        } catch (error) {
            console.error('無法存取相機：', error);
            updateStatus('無法存取相機：' + error.message, 'inactive');
        }
    });

    // 拍攝照片
    capturePhotoBtn.addEventListener('click', function() {
        if (!stream) {
            updateStatus('請先開啟相機', 'inactive');
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = cameraVideo.videoWidth;
        canvas.height = cameraVideo.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(cameraVideo, 0, 0);
        
        // 將照片轉換為 base64
        photoData = canvas.toDataURL('image/jpeg');
        
        // 顯示預覽
        previewImg.src = photoData;
        previewImg.style.display = 'block';
        cameraVideo.style.display = 'none';
        analyzePhotoBtn.disabled = false;
        
        updateStatus('照片已拍攝', 'active');
    });

    // 分析照片
    analyzePhotoBtn.addEventListener('click', async function() {
        if (!photoData) {
            updateStatus('請先拍攝照片', 'inactive');
            return;
        }

        const apiKey = await chrome.storage.local.get('apiKey');
        if (!apiKey.apiKey) {
            updateStatus('請先設定 API Key', 'inactive');
            return;
        }

        updateStatus('正在分析照片...', 'active');
        analyzePhotoBtn.disabled = true;
        document.getElementById('analysisResult').style.display = 'none';

        try {
            const response = await analyzePhotoWithAPI(photoData, apiKey.apiKey);
            
            // 顯示分析結果
            const analysisResult = document.getElementById('analysisResult');
            analysisResult.innerHTML = formatText(response);
            analysisResult.style.display = 'block';
            
            // 更新最近的照片列表
            chrome.storage.local.get('recentFiles', function(result) {
                const recentFiles = result.recentFiles || [];
                const newFile = {
                    image: photoData,
                    analysis: response,
                    timestamp: new Date().toISOString()
                };
                const updatedFiles = [newFile, ...recentFiles].slice(0, 10);
                chrome.storage.local.set({ recentFiles: updatedFiles });
                updateRecentFiles(updatedFiles);
            });

            updateStatus('分析完成', 'active');
        } catch (error) {
            console.error('分析錯誤：', error);
            updateStatus('分析失敗：' + error.message, 'inactive');
        } finally {
            analyzePhotoBtn.disabled = false;
        }
    });

    // 更新狀態顯示
    function updateStatus(message, className) {
        statusDiv.className = 'status ' + className;
        statusDiv.textContent = message;
    }

    // 更新最近的照片列表
    function updateRecentFiles(files) {
        recentFilesDiv.innerHTML = '';
        files.forEach(file => {
            const div = document.createElement('div');
            div.className = 'file-item';
            
            const img = document.createElement('img');
            img.src = file.image;
            
            const info = document.createElement('div');
            info.className = 'info';
            
            const timestamp = document.createElement('div');
            timestamp.className = 'timestamp';
            timestamp.textContent = new Date(file.timestamp).toLocaleString();
            
            const analysis = document.createElement('div');
            analysis.className = 'analysis';
            analysis.innerHTML = formatText(file.analysis);
            
            info.appendChild(timestamp);
            info.appendChild(analysis);
            
            div.appendChild(img);
            div.appendChild(info);
            
            // 點擊顯示分結果
            div.addEventListener('click', function() {
                const analysisResult = document.getElementById('analysisResult');
                analysisResult.innerHTML = formatText(file.analysis);
                analysisResult.style.display = 'block';
                updateStatus('顯示歷史分析結果', 'active');
            });
            
            recentFilesDiv.appendChild(div);
        });
    }

    // 停止相機
    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
            cameraVideo.srcObject = null;
            cameraVideo.style.display = 'none';
            startCameraBtn.textContent = '開啟相機';
            capturePhotoBtn.disabled = true;
            updateStatus('相機已關閉', 'inactive');
        }
    }

    // 匯出歷史紀錄
    exportHistoryBtn.addEventListener('click', function() {
        chrome.storage.local.get('recentFiles', function(result) {
            const recentFiles = result.recentFiles || [];
            
            // 準備文字內容
            const textContent = 
                '=== 相機照片分析器歷史紀錄 ===\n' +
                `匯出時間：${new Date().toLocaleString()}\n` +
                '===============================\n\n' +
                recentFiles.map(file => {
                    return `【時間】${new Date(file.timestamp).toLocaleString()}\n` +
                           `【分析結果】\n` +
                           `${file.analysis}\n` +
                           `\n${'='.repeat(50)}\n\n`;
                }).join('');

            // 建立下載連結
            const blob = new Blob(['\uFEFF' + textContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `相機照片分析器_歷史紀錄_${new Date().toLocaleDateString()}.txt`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        });
    });

    // 清除歷史紀錄
    clearHistoryBtn.addEventListener('click', function() {
        if (confirm('確定要清除所有歷史紀錄嗎？此操作無法復原。')) {
            chrome.storage.local.remove('recentFiles', function() {
                updateRecentFiles([]);
                updateStatus('歷史紀錄已清除', 'active');
                document.getElementById('analysisResult').style.display = 'none';
            });
        }
    });
});

// 使用 OpenAI API 分析照片
async function analyzePhotoWithAPI(photoData, apiKey) {
    const base64Image = photoData.split(',')[1];
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini-2024-07-18",
                messages: [
                    {
                        "role": "system",
                        "content": systemPrompt
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "請分析這張物品圖片："
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": `data:image/jpeg;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7,
                top_p: 0.9
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API 錯誤詳情：', errorData);
            throw new Error(`API 錯誤：${response.status} - ${errorData.error?.message || '未知錯誤'}`);
        }

        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('API 回應格式錯誤');
        }

        const analysis = data.choices[0].message.content;
        
        // 判斷回收狀態
        let recyclingStatus;
        if (analysis.includes("不可回收")) {
            recyclingStatus = "❌ 此物品不符合回收標準。";
        } else if (analysis.includes("無法分析") || analysis.includes("無法辨識")) {
            recyclingStatus = "❌ 可能含有人物或著作商標，請重新拍攝。";
        } else {
            recyclingStatus = "✅ 此物品符合回收標準。";
        }

        return analysis + "\n\n" + recyclingStatus;
    } catch (error) {
        console.error('API 請求錯誤：', error);
        throw error;
    }
}

// 添加文字格式化函數
function formatText(text) {
    return text
        .replace(/\n/g, '<br>')  // 換行
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // 粗體
        .replace(/\*(.*?)\*/g, '<em>$1</em>')  // 斜體
        .replace(/^- (.*)/gm, '• $1')  // 列表項目
        .replace(/【(.*?)】/g, '<h3>$1</h3>')  // 標題
        .replace(/「(.*?)」/g, '<q>$1</q>');  // 引用
} 