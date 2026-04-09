// ========================================
// Feedback App - JavaScript
// ========================================

// DOM要素の取得
const feedbackForm = document.getElementById('feedbackForm');
const feedbackContainer = document.getElementById('feedbackContainer');

// ページロード時の処理
document.addEventListener('DOMContentLoaded', () => {
    loadFeedback();

    if (feedbackForm) {
        feedbackForm.addEventListener('submit', handleFormSubmit);
    }
});

// ========================================
// フォーム送信処理
// ========================================
function handleFormSubmit(e) {
    e.preventDefault();

    // フォーム入力値の取得
    const name = document.getElementById('name').value.trim();
    const category = document.getElementById('category').value;
    const message = document.getElementById('message').value.trim();

    // バリデーション
    if (!name || !category || !message) {
        alert('すべての項目を入力してください');
        return;
    }

    // フィードバックオブジェクトの作成
    const feedback = {
        id: Date.now().toString(),
        name: name,
        category: category,
        message: message,
        timestamp: new Date().toISOString()
    };

    // LocalStorageに保存
    saveFeedback(feedback);

    // フォームのリセット
    feedbackForm.reset();

    // フィードバックリストの再読み込み
    loadFeedback();

    // 成功メッセージ
    alert('フィードバックを送信しました。ありがとうございました！');
}

// ========================================
// LocalStorage操作
// ========================================
function saveFeedback(feedback) {
    const key = `feedback_${feedback.id}`;
    localStorage.setItem(key, JSON.stringify(feedback));
}

function loadFeedback() {
    if (!feedbackContainer) return;

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

    // フィードバックを表示
    displayFeedback(feedbackList);
}

function deleteFeedback(id) {
    if (confirm('このフィードバックを削除してもよろしいですか？')) {
        localStorage.removeItem(`feedback_${id}`);
        loadFeedback();
    }
}

// ========================================
// 表示処理
// ========================================
function displayFeedback(feedbackList) {
    if (feedbackList.length === 0) {
        feedbackContainer.innerHTML = '<p class="empty-message">フィードバックはまだありません</p>';
        return;
    }

    let html = '';
    feedbackList.forEach(feedback => {
        const timestamp = new Date(feedback.timestamp).toLocaleString('ja-JP');
        const categoryLabel = getCategoryLabel(feedback.category);
        const truncatedMessage = feedback.message.length > 100
            ? feedback.message.substring(0, 100) + '...'
            : feedback.message;

        html += `
            <div class="feedback-item">
                <h3>${escapeHtml(feedback.name)}</h3>
                <div class="meta">
                    <span class="category">${categoryLabel}</span>
                    <span>${timestamp}</span>
                </div>
                <p class="message">${escapeHtml(truncatedMessage).replace(/\n/g, '<br>')}</p>
                <div class="actions">
                    <a href="viewer.html?id=${feedback.id}" class="btn btn-secondary">詳細を見る</a>
                    <button onclick="deleteFeedback('${feedback.id}')" class="btn btn-delete">削除</button>
                </div>
            </div>
        `;
    });

    feedbackContainer.innerHTML = html;
}

// ========================================
// ユーティリティ関数
// ========================================
function getCategoryLabel(category) {
    const labels = {
        'bug': 'バグ報告',
        'feature': '機能リクエスト',
        'improvement': '改善提案',
        'other': 'その他'
    };
    return labels[category] || category;
}

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
