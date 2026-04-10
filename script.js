// ========================================
// 匿名フィードバック - JavaScript (Supabase対応)
// ========================================

// Supabase 接続情報
const supabaseUrl = "https://xwrgmsivmpxbkqsytcqs.supabase.co";
const supabaseKey = "sb_publishable_YnsXwDM4JidBO5UtVr6KXQ_CK3HTPGr";
const TABLE_NAME = "feedbacks";
const DRAFT_STORAGE_KEY = "feedback_confirmation_draft";
const ADMIN_PASSWORD = "nnnaaatttsssuuummmiiizzzuuu";
const ADMIN_AUTH_STORAGE_KEY = "feedback_admin_authenticated";
const EDIT_MODE_PARAM = "mode";
const EDIT_MODE_VALUE = "edit";
const ATTACHMENT_META_PREFIX = "__FEEDBACK_ATTACHMENT__";
const MAX_ATTACHMENT_SIZE_BYTES = 3 * 1024 * 1024;
const PRESENTER_NAMES = [
    "山木 秀治",
    "富澤 優華",
    "谷 まゆ子",
    "野口 千彩子",
    "大井 琉誠 LEE J",
    "川口 ひより",
    "杉原 有哉",
    "白子 政弘",
    "筒井 沙莉奈",
    "仲村 望来",
    "田村 晴香",
    "工藤 サフィア",
    "宿利 忠海",
    "平松先生"
];

let currentAttachment = null;

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
    const presenterField = document.getElementById('presenter');
    const presenterSelect = document.getElementById('presenterSelect');
    const confirmSubmitButton = document.getElementById('confirmSubmitButton');
    const deleteAllFeedbackButton = document.getElementById('deleteAllFeedbackButton');
    const adminLoginButton = document.getElementById('adminLoginButton');
    const adminPasswordInput = document.getElementById('adminPassword');
    const attachmentInput = document.getElementById('attachmentInput');
    const attachmentDropzone = document.getElementById('attachmentDropzone');

    populatePresenterOptions(presenterField);
    populatePresenterOptions(presenterSelect);

    if (feedbackForm) {
        populateFormFromDraft();
        initializeIndexPage();
        initializeAttachmentField(attachmentInput, attachmentDropzone);
        feedbackForm.addEventListener('submit', handleFormConfirm);
    }

    if (presenterSelect) {
        presenterSelect.addEventListener('change', handlePresenterChange);
    }

    if (confirmSubmitButton) {
        populateConfirmationPage();
        confirmSubmitButton.addEventListener('click', handleConfirmedSubmit);
    }

    if (deleteAllFeedbackButton) {
        deleteAllFeedbackButton.addEventListener('click', handleDeleteAllFeedbacks);
    }

    if (adminLoginButton) {
        initializeAdminPage();
        adminLoginButton.addEventListener('click', handleAdminLogin);
    }

    if (adminPasswordInput) {
        adminPasswordInput.addEventListener('keydown', handleAdminPasswordKeydown);
    }
}

function isSupabaseAvailable() {
    return !!(supabaseClient && supabaseUrl && supabaseKey);
}

function populatePresenterOptions(selectElement) {
    if (!selectElement) {
        return;
    }

    const selectedValue = selectElement.value;
    const placeholder = selectElement.dataset.placeholder || '選択してください';

    selectElement.innerHTML = '';

    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    selectElement.appendChild(placeholderOption);

    PRESENTER_NAMES.forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        selectElement.appendChild(option);
    });

    if (PRESENTER_NAMES.includes(selectedValue)) {
        selectElement.value = selectedValue;
    }
}

function isEditMode() {
    const params = new URLSearchParams(window.location.search);
    return params.get(EDIT_MODE_PARAM) === EDIT_MODE_VALUE;
}

function getEditContextFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return {
        mode: params.get(EDIT_MODE_PARAM),
        source: params.get('source'),
        id: params.get('id'),
        key: params.get('key')
    };
}

// ========================================
// 投稿ページ: フォーム確認処理
// ========================================
function initializeIndexPage() {
    if (!isEditMode()) {
        return;
    }

    applyIndexEditModeText();
    const draft = getDraftFeedback();

    if (draft && draft.mode === EDIT_MODE_VALUE) {
        populateFormFromDraft();
        return;
    }

    loadFeedbackForEditing();
}

function handleFormConfirm(event) {
    event.preventDefault();

    const payload = getFeedbackFormData();

    if (!payload.presenter_name || !payload.good_point || !payload.improvement_point) {
        alert('発表者名、良かった点、改善するべき点は必須です');
        return;
    }

    const editContext = getEditContextFromUrl();
    const draftPayload = {
        ...payload,
        mode: isEditMode() ? EDIT_MODE_VALUE : 'create',
        source: editContext.source || null,
        id: editContext.id || null,
        key: editContext.key || null
    };

    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));
    window.location.href = 'confirm.html';
}

async function handleConfirmedSubmit() {
    const payload = getDraftFeedback();

    if (!payload || !payload.presenter_name || !payload.good_point || !payload.improvement_point) {
        alert('確認する内容が見つかりませんでした。入力画面からやり直してください');
        window.location.href = 'index.html';
        return;
    }

    showLoading(true);

    try {
        if (payload.mode === EDIT_MODE_VALUE) {
            if (payload.source === 'supabase') {
                await updateFeedbackSupabase(payload);
            } else if (payload.source === 'local') {
                updateFeedbackLocal(payload);
            } else {
                throw new Error('編集対象の保存先情報がありません');
            }
        } else {
            if (isSupabaseAvailable()) {
                await insertFeedbackSupabase(payload);
            } else {
                saveFeedbackLocal({ ...payload, created_at: new Date().toISOString() });
            }
        }

        sessionStorage.removeItem(DRAFT_STORAGE_KEY);

        const confirmSection = document.getElementById('confirmSection');
        if (confirmSection) {
            confirmSection.style.display = 'none';
        }
        updateConfirmationSuccessText(payload.mode === EDIT_MODE_VALUE);
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
        .insert([buildSupabasePayload(payload)]);

    if (error) {
        throw error;
    }
}

async function updateFeedbackSupabase(payload) {
    const { error } = await supabaseClient
        .from(TABLE_NAME)
        .update(buildSupabasePayload(payload))
        .eq('id', payload.id);

    if (error) {
        throw error;
    }
}

function saveFeedbackLocal(feedback) {
    const key = `feedback_${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(feedback));
}

function updateFeedbackLocal(payload) {
    if (!payload.key) {
        throw new Error('ローカル保存のキーが見つかりません');
    }

    const existing = localStorage.getItem(payload.key);
    const createdAt = existing ? JSON.parse(existing).created_at : new Date().toISOString();

    localStorage.setItem(payload.key, JSON.stringify({
        presenter_name: payload.presenter_name,
        good_point: payload.good_point,
        improvement_point: payload.improvement_point,
        notes: payload.notes || null,
        attachment: payload.attachment || null,
        created_at: createdAt
    }));
}

function buildSupabasePayload(payload) {
    return {
        presenter_name: payload.presenter_name,
        good_point: payload.good_point,
        improvement_point: payload.improvement_point,
        notes: packNotesField(payload.notes, payload.attachment)
    };
}

async function deleteAllFeedbacksSupabase() {
    const { error } = await supabaseClient
        .from(TABLE_NAME)
        .delete()
        .neq('presenter_name', '');

    if (error) {
        throw error;
    }
}

async function handleDeleteAllFeedbacks() {
    if (!isSupabaseAvailable()) {
        alert('Supabase に接続できないため、この管理ページでは削除できません');
        return;
    }

    const confirmed = window.confirm('Supabase に保存されたフィードバックを全件削除します。よろしいですか？');
    if (!confirmed) {
        return;
    }

    showLoading(true);

    try {
        await deleteAllFeedbacksSupabase();

        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) {
            adminPanel.style.display = 'none';
        }

        const successMessage = document.getElementById('adminSuccessMessage');
        if (successMessage) {
            successMessage.style.display = 'block';
        }
    } catch (error) {
        console.error(error);
        alert('全件削除に失敗しました。もう一度お試しください');
    } finally {
        showLoading(false);
    }
}

function initializeAdminPage() {
    if (isAdminAuthenticated()) {
        showAdminPanel();
    } else {
        showAdminLogin();
    }
}

function handleAdminLogin() {
    const passwordInput = document.getElementById('adminPassword');
    const loginError = document.getElementById('adminLoginError');
    const password = passwordInput ? passwordInput.value : '';

    if (password === ADMIN_PASSWORD) {
        sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, 'true');
        if (loginError) {
            loginError.style.display = 'none';
        }
        if (passwordInput) {
            passwordInput.value = '';
        }
        showAdminPanel();
        return;
    }

    if (loginError) {
        loginError.style.display = 'block';
    }
}

function handleAdminPasswordKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        handleAdminLogin();
    }
}

function isAdminAuthenticated() {
    return sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === 'true';
}

function showAdminPanel() {
    const loginPanel = document.getElementById('adminLoginPanel');
    const adminPanel = document.getElementById('adminPanel');

    if (loginPanel) {
        loginPanel.style.display = 'none';
    }

    if (adminPanel) {
        adminPanel.style.display = 'block';
    }
}

function showAdminLogin() {
    const loginPanel = document.getElementById('adminLoginPanel');
    const adminPanel = document.getElementById('adminPanel');

    if (loginPanel) {
        loginPanel.style.display = 'block';
    }

    if (adminPanel) {
        adminPanel.style.display = 'none';
    }
}

function getFeedbackFormData() {
    return {
        presenter_name: document.getElementById('presenter').value.trim(),
        good_point: document.getElementById('positive').value.trim(),
        improvement_point: document.getElementById('improvement').value.trim(),
        notes: document.getElementById('remarks').value.trim() || null,
        attachment: currentAttachment
    };
}

function getDraftFeedback() {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function populateFormFromDraft() {
    const draft = getDraftFeedback();
    if (!draft) return;

    const presenter = document.getElementById('presenter');
    const positive = document.getElementById('positive');
    const improvement = document.getElementById('improvement');
    const remarks = document.getElementById('remarks');

    if (presenter) presenter.value = draft.presenter_name || '';
    if (positive) positive.value = draft.good_point || '';
    if (improvement) improvement.value = draft.improvement_point || '';
    if (remarks) remarks.value = draft.notes || '';
    currentAttachment = draft.attachment || null;
    renderAttachmentPreview(currentAttachment);
}

function populateConfirmationPage() {
    const draft = getDraftFeedback();
    if (!draft) {
        alert('確認する内容が見つかりませんでした。入力画面へ戻ります');
        window.location.href = 'index.html';
        return;
    }

    setConfirmationText('confirmPresenter', draft.presenter_name);
    setConfirmationText('confirmPositive', draft.good_point);
    setConfirmationText('confirmImprovement', draft.improvement_point);
    setConfirmationText('confirmRemarks', draft.notes || 'なし');
    renderConfirmationAttachment(draft.attachment || null);
    applyConfirmationModeText(draft.mode === EDIT_MODE_VALUE, draft);
}

function setConfirmationText(elementId, text) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = text || '';
}

async function loadFeedbackForEditing() {
    const editContext = getEditContextFromUrl();

    if (!editContext.source || (!editContext.id && !editContext.key)) {
        alert('修正対象の情報が見つかりませんでした');
        window.location.href = 'viewer.html';
        return;
    }

    showLoading(true);

    try {
        let feedback = null;

        if (editContext.source === 'supabase') {
            if (!isSupabaseAvailable()) {
                throw new Error('Supabase に接続できません');
            }
            feedback = await fetchFeedbackSupabaseById(editContext.id);
        } else if (editContext.source === 'local') {
            feedback = fetchFeedbackLocalByKey(editContext.key);
        }

        if (!feedback) {
            throw new Error('修正対象のフィードバックが見つかりません');
        }

        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
            presenter_name: feedback.presenter_name,
            good_point: feedback.good_point,
            improvement_point: feedback.improvement_point,
            notes: feedback.notes || null,
            attachment: feedback.attachment || null,
            mode: EDIT_MODE_VALUE,
            source: editContext.source,
            id: editContext.id || null,
            key: editContext.key || null
        }));

        populateFormFromDraft();
    } catch (error) {
        console.error(error);
        alert('修正内容の読み込みに失敗しました');
        window.location.href = 'viewer.html';
    } finally {
        showLoading(false);
    }
}

async function fetchFeedbackSupabaseById(id) {
    const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .select('id,presenter_name,good_point,improvement_point,notes')
        .eq('id', id)
        .single();

    if (error) {
        throw error;
    }

    return normalizeStoredFeedback(data);
}

function fetchFeedbackLocalByKey(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return normalizeStoredFeedback(JSON.parse(raw));
}

function applyIndexEditModeText() {
    const title = document.getElementById('indexPageTitle');
    const subtitle = document.getElementById('indexPageSubtitle');
    const submitButton = document.getElementById('feedbackSubmitButton');

    if (title) title.textContent = 'フィードバック修正';
    if (subtitle) subtitle.textContent = '内容を修正して確認画面へ進んでください';
    if (submitButton) submitButton.textContent = '修正内容を確認する';
}

function applyConfirmationModeText(isEditing, draft) {
    const title = document.getElementById('confirmPageTitle');
    const subtitle = document.getElementById('confirmPageSubtitle');
    const submitButton = document.getElementById('confirmSubmitButton');
    const backLink = document.getElementById('confirmBackLink');

    if (isEditing) {
        if (title) title.textContent = '修正内容の確認';
        if (subtitle) subtitle.textContent = '更新前に修正内容をご確認ください';
        if (submitButton) submitButton.textContent = 'この内容で更新する';
        if (backLink) {
            backLink.href = `index.html?mode=edit&source=${encodeURIComponent(draft.source || '')}${draft.id ? `&id=${encodeURIComponent(draft.id)}` : ''}${draft.key ? `&key=${encodeURIComponent(draft.key)}` : ''}`;
        }
        return;
    }

    if (title) title.textContent = '入力内容の確認';
    if (subtitle) subtitle.textContent = '送信前に内容をご確認ください';
    if (submitButton) submitButton.textContent = 'この内容で送信する';
    if (backLink) backLink.href = 'index.html';
}

function updateConfirmationSuccessText(isEditing) {
    const title = document.querySelector('#successMessage .success-content h3');
    const message = document.querySelector('#successMessage .success-content p');

    if (!title || !message) return;

    if (isEditing) {
        title.textContent = '✓ フィードバックを更新しました';
        message.textContent = '修正内容を保存しました。';
        return;
    }

    title.textContent = '✓ フィードバックを送信しました';
    message.textContent = 'ご協力ありがとうございました。';
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
        .select('id,presenter_name,good_point,improvement_point,notes,created_at')
        .eq('presenter_name', presenter)
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    renderFeedbackList(data.map(normalizeStoredFeedback), presenter);
}

function displayFeedbackFromLocalStorage(presenter) {
    const feedbacks = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('feedback_')) continue;

        try {
            const item = normalizeStoredFeedback(JSON.parse(localStorage.getItem(key)));
            if (item.presenter_name === presenter) {
                feedbacks.push({ ...item, storage_key: key });
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
                ${renderAttachmentSection(item.attachment)}
                <div class="feedback-timestamp">投稿日時: ${createdAt}</div>
                <div class="feedback-item-actions">
                    <a href="${buildEditLink(item)}" class="btn btn-secondary">修正する</a>
                </div>
            </div>
        `;
    });

    document.getElementById('feedbackList').innerHTML = html;
}

function buildEditLink(item) {
    if (item.id) {
        return `index.html?mode=edit&source=supabase&id=${encodeURIComponent(item.id)}`;
    }

    if (item.storage_key) {
        return `index.html?mode=edit&source=local&key=${encodeURIComponent(item.storage_key)}`;
    }

    return 'index.html';
}

function initializeAttachmentField(attachmentInput, attachmentDropzone) {
    if (!attachmentInput || !attachmentDropzone) {
        return;
    }

    attachmentInput.addEventListener('change', handleAttachmentInputChange);
    attachmentDropzone.addEventListener('click', () => attachmentInput.click());
    attachmentDropzone.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            attachmentInput.click();
        }
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
        attachmentDropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            attachmentDropzone.classList.add('is-dragover');
        });
    });

    ['dragleave', 'dragend', 'drop'].forEach((eventName) => {
        attachmentDropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            attachmentDropzone.classList.remove('is-dragover');
        });
    });

    attachmentDropzone.addEventListener('drop', async (event) => {
        const [file] = Array.from(event.dataTransfer.files || []);
        await setAttachmentFromFile(file);
        attachmentInput.value = '';
    });
}

async function handleAttachmentInputChange(event) {
    const [file] = Array.from(event.target.files || []);
    await setAttachmentFromFile(file);
    event.target.value = '';
}

async function setAttachmentFromFile(file) {
    if (!file) {
        return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        alert('添付ファイルは 3MB 以下にしてください');
        return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    currentAttachment = {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl
    };

    renderAttachmentPreview(currentAttachment);
}

function renderAttachmentPreview(attachment) {
    const preview = document.getElementById('attachmentPreview');
    if (!preview) {
        return;
    }

    if (!attachment) {
        preview.style.display = 'none';
        preview.innerHTML = '';
        return;
    }

    const safeName = escapeHtml(attachment.name || '添付ファイル');
    const safeUrl = escapeHtml(attachment.dataUrl || '#');
    const sizeLabel = formatFileSize(attachment.size || 0);
    const isImage = typeof attachment.type === 'string' && attachment.type.startsWith('image/');

    preview.style.display = 'block';
    preview.innerHTML = `
        <div class="attachment-preview-card">
            ${isImage ? `<img src="${safeUrl}" alt="${safeName}" class="attachment-preview-image">` : ''}
            <div class="attachment-preview-meta">
                <p class="attachment-preview-name">${safeName}</p>
                <p class="attachment-preview-size">${sizeLabel}</p>
            </div>
            <button type="button" class="btn btn-secondary attachment-remove-button">添付を外す</button>
        </div>
    `;

    const removeButton = preview.querySelector('.attachment-remove-button');
    if (removeButton) {
        removeButton.addEventListener('click', clearAttachment);
    }
}

function renderConfirmationAttachment(attachment) {
    const container = document.getElementById('confirmAttachment');
    if (!container) {
        return;
    }

    if (!attachment) {
        container.innerHTML = '<p>なし</p>';
        return;
    }

    const safeName = escapeHtml(attachment.name || '添付ファイル');
    const safeUrl = escapeHtml(attachment.dataUrl || '#');
    const sizeLabel = formatFileSize(attachment.size || 0);
    const isImage = typeof attachment.type === 'string' && attachment.type.startsWith('image/');

    container.innerHTML = `
        <div class="attachment-preview-card confirmation-attachment-card">
            ${isImage ? `<img src="${safeUrl}" alt="${safeName}" class="attachment-preview-image">` : ''}
            <div class="attachment-preview-meta">
                <p class="attachment-preview-name">${safeName}</p>
                <p class="attachment-preview-size">${sizeLabel}</p>
                <p><a href="${safeUrl}" download="${safeName}" class="attachment-link">${safeName} を開く</a></p>
            </div>
        </div>
    `;
}

function clearAttachment() {
    currentAttachment = null;
    renderAttachmentPreview(null);
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function formatFileSize(size) {
    if (size >= 1024 * 1024) {
        return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    }
    if (size >= 1024) {
        return `${Math.round(size / 1024)} KB`;
    }
    return `${size} B`;
}

function packNotesField(notes, attachment) {
    if (!attachment) {
        return notes || null;
    }

    return `${ATTACHMENT_META_PREFIX}${JSON.stringify({
        notes: notes || null,
        attachment
    })}`;
}

function unpackNotesField(rawNotes) {
    if (typeof rawNotes === 'string' && rawNotes.startsWith(ATTACHMENT_META_PREFIX)) {
        try {
            const parsed = JSON.parse(rawNotes.slice(ATTACHMENT_META_PREFIX.length));
            return {
                notes: parsed.notes || null,
                attachment: parsed.attachment || null
            };
        } catch {
            return {
                notes: rawNotes,
                attachment: null
            };
        }
    }

    return {
        notes: rawNotes || null,
        attachment: null
    };
}

function normalizeStoredFeedback(item) {
    if (!item) {
        return item;
    }

    const unpacked = unpackNotesField(item.notes);
    return {
        ...item,
        notes: unpacked.notes,
        attachment: item.attachment || unpacked.attachment || null
    };
}

function renderAttachmentSection(attachment) {
    if (!attachment) {
        return '';
    }

    const safeName = escapeHtml(attachment.name || '添付ファイル');
    const safeUrl = escapeHtml(attachment.dataUrl || '#');
    const isImage = typeof attachment.type === 'string' && attachment.type.startsWith('image/');

    return `
        <div class="feedback-section">
            <h3>添付ファイル</h3>
            ${isImage ? `<img src="${safeUrl}" alt="${safeName}" class="feedback-attachment-image">` : ''}
            <p><a href="${safeUrl}" download="${safeName}" class="attachment-link">${safeName}</a></p>
        </div>
    `;
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
