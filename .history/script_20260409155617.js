// ========================================
// 匿名フィードバック - JavaScript (Supabase対応)
// ========================================

// Supabase 接続情報
const supabaseUrl = "https://xwrgmsivmpxbkqsytcqs.supabase.co";
const supabaseKey = "sb_publishable_YnsXwDM4JidBO5UtVr6KXQ_CK3HTPGr";
const TABLE_NAME = "feedbacks";

const supabaseClient = window.supabase
    ? window.supabase.createClient(supabaseUrl, supabaseKey)
    : null;

// ページロード時の処理
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

function initializePage() {
    const feedbackForm = document.getElementById('feedbackForm');
    const presenterSelect = document.getElementById('presenterSelect');

    if (feedbackForm) {
        feedbackForm.addEventListener('submit', handleFormSubmit);
    }

    if (presenterSelect) {
        presenterSelect.addEventListener('change', handlePresenterChange);
    }
}

function isSupabaseAvailable() {
    return !!(supabaseClient && supabaseUrl && supabaseKey);
}

// ========================================
// 投稿ページ: フォーム送信処理
// ========================================
async function handleFormSubmit(event) {
    event.preventDefault();

    const presenter = document.getElementById('presenter').value.trim();
    const goodPoint = document.getElementById('positive').value.trim();
    const improvementPoint = document.getElementById('improvement').value.trim();
    const notes = document.getElementById('remarks').value.trim();

    if (!presenter || !goodPoint || !improvementPoint) {
        alert('発表者名、良かった点、改善するべき点は必須です');
        return;
    }

    showLoading(true);

    try {
        const payload = {
            presenter_name: presenter,
            good_point: goodPoint,
            improvement_point: improvementPoint,
            notes: notes || null
        };

        if (isSupabaseAvailable()) {
            await insertFeedbackSupabase(payload);
        } else {
            saveFeedbackLocal({ ...payload, created_at: new Date().toISOString() });
        }

        document.getElementById('feedbackForm').reset();
        document.getElementById('feedbackForm').style.display = 'none';
        document.getElementById('successMessage').style.display = 'block';
    } catch (error) {
        console.error(error);
        alert('送信に失敗しました。もう一度お試しください');
    } finally {
        showLoading(false);
    }
}

async function insertFeedbackSupabase(payload) {
    const { error } = await supabaseClient
        .from(TABLE_NAME)
        .insert([payload]);

    if (error) {
        throw error;
    }
}

function saveFeedbackLocal(feedback) {
    const key = `feedback_${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(feedback));
}

// ========================================
// 閲覧ページ: 発表者選択時の処理
// ========================================
async function handlePresenterChange() {
    const presenter = document.getElementById('presenterSelect').value;

    if (!presenter) {
        document.getElementById('feedbackList').innerHTML =
            '<p class="empty-message">発表者を選択するとフィードバックが表示されます</p>';
        return;
    }

    showLoading(true);

    try {
        if (isSupabaseAvailable()) {
            await displayFeedbackFromSupabase(presenter);
        } else {
            displayFeedbackFromLocalStorage(presenter);
        }
    } catch (error) {
        console.error(error);
        document.getElementById('feedbackList').innerHTML =
            '<p class="empty-message">読み込み中にエラーが発生しました</p>';
    } finally {
        showLoading(false);
    }
}

async function displayFeedbackFromSupabase(presenter) {
    const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .select('presenter_name,good_point,improvement_point,notes,created_at')
        .eq('presenter_name', presenter)
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    renderFeedbackList(data, presenter);
}

function displayFeedbackFromLocalStorage(presenter) {
    const feedbacks = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('feedback_')) continue;

        try {
            const item = JSON.parse(localStorage.getItem(key));
            if (item.presenter_name === presenter) {
                feedbacks.push(item);
            }
        } catch {
            continue;
        }
    }

    feedbacks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    renderFeedbackList(feedbacks, presenter);
}

function renderFeedbackList(list, presenter) {
    if (!list || list.length === 0) {
        document.getElementById('feedbackList').innerHTML =
            `<p class="empty-message">${escapeHtml(presenter)} さんへのフィードバックはまだありません</p>`;
        return;
    }

    let html = '';
    list.forEach((item, index) => {
        const createdAt = item.created_at
            ? new Date(item.created_at).toLocaleString('ja-JP')
            : '日時情報なし';

        html += `
            <div class="feedback-item">
                <div class="feedback-number">フィードバック #${index + 1}</div>
                <div class="feedback-section">
                    <h3>良かった点</h3>
                    <p>${escapeHtml(item.good_point).replace(/\n/g, '<br>')}</p>
                </div>
                <div class="feedback-section">
                    <h3>改善するべき点</h3>
                    <p>${escapeHtml(item.improvement_point).replace(/\n/g, '<br>')}</p>
                </div>
                ${item.notes ? `
                    <div class="feedback-section">
                        <h3>備考</h3>
                        <p>${escapeHtml(item.notes).replace(/\n/g, '<br>')}</p>
                    </div>
                ` : ''}
                <div class="feedback-timestamp">投稿日時: ${createdAt}</div>
            </div>
        `;
    });

    document.getElementById('feedbackList').innerHTML = html;
}

// ========================================
// ユーティリティ
// ========================================
function showLoading(show) {
    const loader = document.getElementById('loadingSpinner');
    if (!loader) return;
    loader.style.display = show ? 'block' : 'none';
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
