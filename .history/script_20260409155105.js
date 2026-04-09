// ========================================
// 匿名フィードバック - JavaScript (Supabase版)
// ========================================

// Supabase クライアント設定
const supabaseUrl = "https://xwrgmsivmpxbkqsytcqs.supabase.co";
const supabaseKey = "sb_publishable_YnsXwDM4JidBO5UtVr6KXQ_CK3HTPGr";
let supabaseClient = null;

// 設定情報（Supabase URL / Key）
const SUPABASE_CONFIG = {
    url: supabaseUrl,
    key: supabaseKey
};

// ページロード時の処理
document.addEventListener('DOMContentLoaded', () => {
    initializeSupabase();
    initializePage();
});

// Supabaseの初期化
function initializeSupabase() {
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.key) {
        console.warn('Supabase設定が見つかりません。LocalStorageを使用します。');
        return;
    }

    try {
        supabaseClient = window.supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.key
        );
    } catch (error) {
        console.error('Supabase初期化エラー:', error);
    }
}

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
async function handleFormSubmit(e) {
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

    // ローディング表示
    showLoading(true);

    try {
        // Supabaseが利用可能かチェック
        if (supabaseClient) {
            await saveFeedbackToSupabase({
                presenter,
                positive,
                improvement,
                remarks: remarks || null
            });
        } else {
            // フォールバック: LocalStorage
            const feedback = {
                id: Date.now().toString(),
                presenter,
                positive,
                improvement,
                remarks,
                timestamp: new Date().toISOString()
async function handlePresenterChange() {
                    const presenter = document.getElementById('presenterSelect').value;

            if (!presenter) {
                document.getElementById('feedbackList').innerHTML =
                    '<p class="empty-message">発表者を選択するとフィードバックが表示されます</p>';
                return;
            }

            try {
                if (supabaseClient) {
                    await displayFeedbackForPresenterFromSupabase(presenter);
                } else {
                    displayFeedbackForPresenterFromLocalStorage(presenter);
                }
            } catch (error) {
                console.error('読み込みエラー:', error);
                document.getElementById('feedbackList').innerHTML =
                    `<p class="empty-message">エラーが発生しました: ${error.message}</p>`;
            });
            showLoading(false);
        }
    }

// Supabaseにデータを保存
async function saveFeedbackToSupabase(feedback) {
        const { data, error } = await supabaseClient
            .from('feedbacks')
            .insert([{
                presenter: feedback.presenter,
                positive: feedback.positive,
                improvement: feedback.improvement,
                remarks: feedback.remarks
            }]);

        if (error) {
            throw new Error('Supabaseエラー: ' + error.message);
        }

        return data;
    }

    // ========================================
    // 閲覧ページ: 発表者選択時の処理
    // ========================================
    function handlePresenterChange() {
        const presenter = document.getElementById('presenterSelect').value;

        Supabase操作
        // ========================================
        async function displayFeedbackForPresenterFromSupabase(presenter) {
            const { data, error } = await supabaseClient
                .from('feedbacks')
                .select('*')
                .eq('presenter', presenter)
                .order('created_at', { ascending: false });

            if (error) {
                throw new Error(error.message);
            }

            if (!data || data.length === 0) {
                document.getElementById('feedbackList').innerHTML =
                    `<p class="empty-message">${escapeHtml(presenter)} さんへのフィードバックはまだありません</p>`;
                return;
            }

            let html = '';
            data.forEach((feedback, index) => {
                const timestamp = new Date(feedback.created_at).toLocaleString('ja-JP');

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
        // LocalStorage操作（フォールバック）
        // ========================================
        function saveFeedbackToLocalStorage(feedback) {
            const key = `feedback_${feedback.id}`;
            localStorage.setItem(key, JSON.stringify(feedback));
        }

        function getFeedbackListFromLocalStorage() {
            const feedbackList = [];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('feedback_')) {
                    const feedback = JSON.parse(localStorage.getItem(key));
                    feedbackList.push(feedback);
                }
            }

            feedbackList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            return feedbackList;
        }

        function displayFeedbackForPresenterFromLocalStorage(presenter) {
            const feedbackList = getFeedbackListFromLocalStorage();
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
        // UI制御
        // ========================================
        function showLoading(isShow) {
            const spinner = document.getElementById('loadingSpinner');
            if (spinner) {
                spinner.style.display = isShow ? 'block' : 'none';
            }
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
