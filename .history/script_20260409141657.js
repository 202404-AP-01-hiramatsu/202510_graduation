// ========================================
// 匿名フィードバック - JavaScript
// ========================================

// ページロード時の処理
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
});

// ページの初期化
function initializePage() {
    const feedbackForm = document.getElementById('feedbackForm');
    const presenterSelect = document.getElementById('presenterSelect');

    if (feedbackForm) {
        // 投稿ページの初期化
        feedbackForm.addEventListener('submit', handleFormSubmit);
    }

    if (presenterSelect) {
        // 閲覧ページの初期化
        presenterSelect.addEventListener('change', handlePresenterChange);
    }
}

// ========================================
// 投稿ページ: フォーム送信処理
// ========================================
function handleFormSubmit(e) {
    e.preventDefault();

    // フォーム入力値の取得
    const presenter = document.getElementById('presenter').value.trim();
    const positive = document.getElementById('positive').value.trim();
    const improvement = document.getElementById('improvement').value.trim();
    const remarks = document.getElementById('remarks').value.trim();

    // バリデーション
    if (!presenter || !positive || !improvement) {
        alert('発表者名、良かった点、改善するべき点は必須です');
        return;
    }

    // フィードバックオブジェクトの作成
    const feedback = {
        id: Date.now().toString(),
        presenter: presenter,
        positive: positive,
        improvement: improvement,
        remarks: remarks,
        timestamp: new Date().toISOString()
    };

    // LocalStorageに保存
    saveFeedback(feedback);

    // フォームのリセットして完了メッセージ表示
    document.getElementById('feedbackForm').style.display = 'none';
    document.getElementById('successMessage').style.display = 'block';
}

// ========================================
// 閲覧ページ: 発表者選択時の処理
// ========================================
function handlePresenterChange() {
    const presenter = document.getElementById('presenterSelect').value;

    if (!presenter) {
        document.getElementById('feedbackList').innerHTML = 
            '<p class="empty-message">発表者を選択するとフィードバックが表示されます</p>';
        return;
    }

    displayFeedbackForPresenter(presenter);
}

// ========================================
// LocalStorage操作
// ========================================
function saveFeedback(feedback) {
    const key = `feedback_${feedback.id}`;
    localStorage.setItem(key, JSON.stringify(feedback));
}

function getFeedbackList() {
    const feedbackList = [];

    // LocalStorageからすべてのフィードバックを取得
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('feedback_')) {
            const feedback = JSON.parse(localStorage.getItem(key));
            feedbackList.push(feedback);
        }
    }

    // タイムスタンプでソート（新しい順）
    feedbackList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return feedbackList;
}

// ========================================
// 表示処理
// ========================================
function displayFeedbackForPresenter(presenter) {
    const feedbackList = getFeedbackList();
    const filteredFeedback = feedbackList.filter(item => item.presenter === presenter);

    if (filteredFeedback.length === 0) {
        document.getElementById('feedbackList').innerHTML = 
            `<p class="empty-message">${escapeHtml(presenter)} さんへのフィードバックはまだありません</p>`;
        return;
    }

    let html = '';
    filteredFeedback.forEach((feedback, index) => {
        const timestamp = new Date(feedback.timestamp).toLocaleString('ja-JP');
        
        html += `
            <div class="feedback-item">
                <div class="feedback-number">フィードバック #${index + 1}</div>
                
                <div class="feedback-section">
                    <h3>良かった点</h3>
                    <p>${escapeHtml(feedback.positive).replace(/\n/g, '<br>')}</p>
                </div>

                <div class="feedback-section">
                    <h3>改善するべき点</h3>
                    <p>${escapeHtml(feedback.improvement).replace(/\n/g, '<br>')}</p>
                </div>

                ${feedback.remarks ? `
                <div class="feedback-section">
                    <h3>備考</h3>
                    <p>${escapeHtml(feedback.remarks).replace(/\n/g, '<br>')}</p>
                </div>
                ` : ''}

                <div class="feedback-timestamp">
                    投稿日時: ${timestamp}
                </div>
            </div>
        `;
    });

    document.getElementById('feedbackList').innerHTML = html;
}

// ========================================
// ユーティリティ関数
// ========================================
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
