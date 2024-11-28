// 初始化擴充功能
chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.local.set({
        recentFiles: [],
        isFirstRun: true
    });
    
    // 顯示歡迎訊息
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: '相機照片分析器',
        message: '歡迎使用相機照片分析器！請先設定您的 OpenAI API Key。'
    });
});

// 監聽來自彈出視窗的訊息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch (request.action) {
        case 'analyzePhoto':
            // 處理照片分析請求
            handlePhotoAnalysis(request.photoData);
            break;
    }
});

// 處理照片分析
async function handlePhotoAnalysis(photoData) {
    try {
        // 在這裡可以添加額外的處理邏輯
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: '相機照片分析器',
            message: '照片分析完成'
        });
    } catch (error) {
        console.error('處理照片時發生錯誤：', error);
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: '相機照片分析器',
            message: '處理照片時發生錯誤'
        });
    }
} 