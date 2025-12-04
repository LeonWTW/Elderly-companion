/**
 * Elderly Companion - Enhanced Frontend Application
 * 
 * Features:
 * - Profile management
 * - Daily check-in submissions with AI processing overlay
 * - AI feedback display
 * - History management with templates
 * - Font size accessibility toggle
 * - Global error/success notifications
 * - Field-level validation
 */

// =============================================================================
// Configuration & State
// =============================================================================

const API_BASE = '/api';

const state = {
    profile: null,
    checkins: [],
    selectedCheckin: null,
    fontSize: 'medium', // small, medium, large
    isProcessing: false
};

// Local storage key for user preferences
const STORAGE_KEY = 'elderlyCompanionPrefs';

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format a date string to a user-friendly format
 */
function formatDate(dateString) {
    if (!dateString) return 'Unknown';

    try {
        const date = new Date(dateString + 'T12:00:00');
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } catch {
        return dateString;
    }
}

/**
 * Get today's date in YYYY-MM-DD format using local timezone
 */
function getTodayDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Collect client-side timezone and local date metadata
 */
function getClientTimeMeta(selectedDateValue) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    let localDateIso = null;
    if (selectedDateValue) {
        const localDate = new Date(selectedDateValue + 'T12:00:00');
        localDateIso = localDate.toISOString();
    }

    return {
        client_timezone: timezone,
        client_local_date_iso: localDateIso
    };
}

/**
 * Get risk level CSS class
 */
function getRiskClass(riskLevel) {
    if (!riskLevel) return 'pending';
    const level = riskLevel.toLowerCase();
    if (level === 'low') return 'low';
    if (level === 'monitor') return 'monitor';
    if (level === 'concerning') return 'concerning';
    return 'pending';
}

/**
 * Get risk level display text
 */
function getRiskText(riskLevel, aiStatus) {
    if (aiStatus === 'error') return 'Error';
    if (aiStatus === 'pending') return 'Pending';
    if (!riskLevel) return 'N/A';
    return riskLevel;
}

/**
 * Get mood emoji
 */
function getMoodEmoji(mood) {
    switch (mood) {
        case 'Good': return '😊';
        case 'OK': return '😐';
        case 'Low': return '😔';
        default: return '•';
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text, maxLength = 80) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
}

/**
 * Save preferences to local storage
 */
function savePreferences() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            fontSize: state.fontSize
        }));
    } catch (e) {
        console.warn('Could not save preferences:', e);
    }
}

/**
 * Load preferences from local storage
 */
function loadPreferences() {
    try {
        const prefs = localStorage.getItem(STORAGE_KEY);
        if (prefs) {
            const parsed = JSON.parse(prefs);
            if (parsed.fontSize) {
                state.fontSize = parsed.fontSize;
            }
        }
    } catch (e) {
        console.warn('Could not load preferences:', e);
    }
}

// =============================================================================
// Global Notifications (替代 alert())
// =============================================================================

/**
 * Show global error notification
 */
function showGlobalError(message, autoDismiss = true) {
    const container = document.getElementById('global-error');
    if (!container) return;

    const textEl = container.querySelector('.error-text');
    if (textEl) textEl.textContent = message;
    container.hidden = false;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (autoDismiss) {
        setTimeout(() => {
            container.hidden = true;
        }, 8000);
    }
}

/**
 * Show global success notification
 */
function showGlobalSuccess(message, autoDismiss = true) {
    const container = document.getElementById('global-success');
    if (!container) return;

    const textEl = container.querySelector('.success-text');
    if (textEl) textEl.textContent = message;
    container.hidden = false;

    if (autoDismiss) {
        setTimeout(() => {
            container.hidden = true;
        }, 5000);
    }
}

/**
 * Hide global notifications
 */
function hideGlobalNotifications() {
    const errorEl = document.getElementById('global-error');
    const successEl = document.getElementById('global-success');
    if (errorEl) errorEl.hidden = true;
    if (successEl) successEl.hidden = true;
}

/**
 * Show inline message in a container
 */
function showMessage(containerId, message, type = 'success') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.textContent = message;
    container.className = `message ${type}`;
    container.hidden = false;

    if (type === 'success') {
        setTimeout(() => {
            container.hidden = true;
        }, 4000);
    }
}

/**
 * Show field-level error
 */
function showFieldError(fieldId, message) {
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('visible');
    }
}

/**
 * Clear all field errors
 */
function clearFieldErrors() {
    document.querySelectorAll('.field-error').forEach(el => {
        el.textContent = '';
        el.classList.remove('visible');
    });
}

// =============================================================================
// Font Size Toggle
// =============================================================================

/**
 * Initialize font size toggle
 */
function initFontSizeToggle() {
    // Load saved preferences first
    loadPreferences();

    // Apply the saved or default font size
    applyFontSize(state.fontSize);

    // Use event delegation on the toggle container for reliability
    const toggleContainer = document.querySelector('.font-size-toggle');
    if (toggleContainer) {
        toggleContainer.addEventListener('click', function (e) {
            const btn = e.target.closest('.font-btn');
            if (btn && btn.dataset.size) {
                e.preventDefault();
                e.stopPropagation();
                setFontSize(btn.dataset.size);
            }
        });
    }

    console.log('Font size toggle initialized, current size:', state.fontSize);
}

/**
 * Set font size
 */
function setFontSize(size) {
    console.log('Setting font size to:', size);
    state.fontSize = size;
    applyFontSize(size);
    savePreferences();
}

/**
 * Apply font size to body
 */
function applyFontSize(size) {
    const body = document.body;

    // Remove all font size classes
    body.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');

    // Add the new font size class
    body.classList.add('font-size-' + size);

    // Update button active states
    document.querySelectorAll('.font-btn').forEach(btn => {
        if (btn.dataset.size === size) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    console.log('Applied font size:', size, 'to body classes:', body.className);
}

// =============================================================================
// Button Loading States
// =============================================================================

/**
 * Set loading state on a button
 */
function setButtonLoading(button, loading) {
    if (!button) return;

    const textSpan = button.querySelector('.btn-text');
    const loadingSpan = button.querySelector('.btn-loading');

    if (loading) {
        button.disabled = true;
        button.classList.add('btn-loading-state');
        if (textSpan) textSpan.hidden = true;
        if (loadingSpan) loadingSpan.hidden = false;
    } else {
        button.disabled = false;
        button.classList.remove('btn-loading-state');
        if (textSpan) textSpan.hidden = false;
        if (loadingSpan) loadingSpan.hidden = true;
    }
}

// =============================================================================
// AI Processing Overlay
// =============================================================================

/**
 * Show AI processing overlay with animation
 */
function showAIProcessingOverlay() {
    const overlay = document.getElementById('ai-processing-overlay');
    if (!overlay) return;

    overlay.hidden = false;
    state.isProcessing = true;

    const progressFill = overlay.querySelector('.progress-fill');
    if (progressFill) {
        progressFill.style.width = '0%';

        let progress = 0;
        const interval = setInterval(() => {
            if (!state.isProcessing) {
                clearInterval(interval);
                return;
            }

            if (progress < 30) {
                progress += Math.random() * 8;
            } else if (progress < 60) {
                progress += Math.random() * 4;
            } else if (progress < 85) {
                progress += Math.random() * 2;
            } else if (progress < 95) {
                progress += Math.random() * 0.5;
            }

            progress = Math.min(progress, 95);
            progressFill.style.width = `${progress}%`;
        }, 200);

        overlay.dataset.intervalId = interval;
    }
}

/**
 * Hide AI processing overlay
 */
function hideAIProcessingOverlay() {
    const overlay = document.getElementById('ai-processing-overlay');
    if (!overlay) return;

    state.isProcessing = false;

    const progressFill = overlay.querySelector('.progress-fill');
    if (progressFill) {
        progressFill.style.width = '100%';
    }

    if (overlay.dataset.intervalId) {
        clearInterval(parseInt(overlay.dataset.intervalId));
    }

    setTimeout(() => {
        overlay.hidden = true;
        if (progressFill) progressFill.style.width = '0%';
    }, 300);
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Fetch wrapper with robust error handling
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    let response;

    try {
        response = await fetch(url, { ...defaultOptions, ...options });
    } catch (networkError) {
        console.error('Network error while calling API:', networkError);
        throw new Error('Network error. Please check your internet connection and try again.');
    }

    let data = {};
    try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
    } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }
        return {};
    }

    if (!response.ok) {
        const message =
            (data && (data.error || data.message)) ||
            `Request failed with status ${response.status}`;
        throw new Error(message);
    }

    return data;
}

/**
 * Load the profile from the server
 */
async function loadProfile() {
    const loadingEl = document.getElementById('profile-loading');

    try {
        if (loadingEl) loadingEl.hidden = false;

        const data = await apiRequest('/profile');
        state.profile = data.profile;
        populateProfileForm(state.profile);
    } catch (error) {
        console.error('Failed to load profile:', error);
        showMessage('profile-message', 'Failed to load profile: ' + error.message, 'error');
    } finally {
        if (loadingEl) loadingEl.hidden = true;
    }
}

/**
 * Save the profile to the server
 */
async function saveProfile(profileData) {
    const data = await apiRequest('/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData)
    });
    state.profile = data.profile;
    return data.profile;
}

/**
 * Load check-ins from the server
 */
async function loadCheckins() {
    try {
        showHistoryLoading();

        const data = await apiRequest('/checkins?limit=20');
        state.checkins = data.checkins;
        renderCheckinHistory();
        updateHistoryStats();
    } catch (error) {
        console.error('Failed to load check-ins:', error);
        showHistoryError(error.message);
    }
}

/**
 * Create a new check-in
 */
async function createCheckin(checkinData) {
    const data = await apiRequest('/checkins', {
        method: 'POST',
        body: JSON.stringify(checkinData)
    });
    return data.checkin;
}

/**
 * Load a single check-in detail
 */
async function loadCheckinDetail(checkinId) {
    const data = await apiRequest(`/checkins/${checkinId}`);
    return data.checkin;
}

// =============================================================================
// Profile Management
// =============================================================================

/**
 * Populate the profile form with data
 */
function populateProfileForm(profile) {
    if (!profile) return;

    const nameEl = document.getElementById('profile-name');
    const ageEl = document.getElementById('profile-age');
    const eduEl = document.getElementById('profile-education');
    const diagEl = document.getElementById('profile-diagnosis');

    if (nameEl) nameEl.value = profile.name || '';
    if (ageEl) ageEl.value = profile.age || '';
    if (eduEl) eduEl.value = profile.education_years || '';
    if (diagEl) diagEl.value = profile.diagnosis_notes || '';
}

/**
 * Get profile data from the form
 */
function getProfileFormData() {
    return {
        name: document.getElementById('profile-name')?.value.trim() || '',
        age: document.getElementById('profile-age')?.value || null,
        education_years: document.getElementById('profile-education')?.value || null,
        diagnosis_notes: document.getElementById('profile-diagnosis')?.value.trim() || null
    };
}

/**
 * Validate profile form data with field-level errors
 */
function validateProfileData(data) {
    clearFieldErrors();
    let isValid = true;

    if (data.age !== null && data.age !== '') {
        const age = parseInt(data.age);
        if (isNaN(age) || age <= 0 || age > 150) {
            showFieldError('profile-age', 'Age must be between 1 and 150');
            isValid = false;
        }
    }

    if (data.education_years !== null && data.education_years !== '') {
        const years = parseInt(data.education_years);
        if (isNaN(years) || years < 0 || years > 30) {
            showFieldError('profile-education', 'Education years must be between 0 and 30');
            isValid = false;
        }
    }

    return isValid;
}

/**
 * Handle profile form submission
 */
async function handleProfileSubmit(e) {
    e.preventDefault();

    const button = document.getElementById('save-profile-btn');
    const messageContainer = document.getElementById('profile-message');

    if (messageContainer) messageContainer.hidden = true;

    const data = getProfileFormData();

    if (!validateProfileData(data)) {
        return;
    }

    setButtonLoading(button, true);

    try {
        await saveProfile(data);
        showMessage('profile-message', 'Profile saved successfully!', 'success');
        showGlobalSuccess('Profile saved successfully!');
    } catch (error) {
        console.error('Failed to save profile:', error);
        showMessage('profile-message', error.message || 'Failed to save profile', 'error');
        showGlobalError('Failed to save profile: ' + error.message);
    } finally {
        setButtonLoading(button, false);
    }
}

/**
 * Toggle profile section visibility
 */
function toggleProfileSection() {
    const button = document.getElementById('toggle-profile');
    const container = document.getElementById('profile-form-container');
    if (!button || !container) return;

    const isExpanded = button.getAttribute('aria-expanded') === 'true';

    button.setAttribute('aria-expanded', !isExpanded);
    container.classList.toggle('collapsed', isExpanded);
}

// =============================================================================
// Check-in Form Management
// =============================================================================

/**
 * Initialize the check-in form
 */
function initCheckinForm() {
    const dateInput = document.getElementById('checkin-date');
    if (dateInput) dateInput.value = getTodayDate();

    initScoreButtons('memory-score-buttons', 'memory-score');
    initScoreButtons('orientation-score-buttons', 'orientation-score');
    initScoreButtons('activities-score-buttons', 'activities-score');

    initMoodButtons();
    initCharacterCount();
}

/**
 * Initialize score button group
 */
function initScoreButtons(containerId, inputId) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    if (!container || !input) return;

    container.querySelectorAll('.score-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.score-btn').forEach(b => {
                b.classList.remove('selected');
                b.setAttribute('aria-checked', 'false');
            });

            btn.classList.add('selected');
            btn.setAttribute('aria-checked', 'true');
            input.value = btn.dataset.value;

            // Clear field error
            const errorEl = document.getElementById(`${inputId}-error`);
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.classList.remove('visible');
            }
        });
    });
}

/**
 * Initialize mood buttons
 */
function initMoodButtons() {
    const container = document.getElementById('mood-buttons');
    const input = document.getElementById('mood');
    if (!container || !input) return;

    container.querySelectorAll('.mood-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.mood-btn').forEach(b => {
                b.classList.remove('selected');
                b.setAttribute('aria-checked', 'false');
            });

            btn.classList.add('selected');
            btn.setAttribute('aria-checked', 'true');
            input.value = btn.dataset.value;

            const errorEl = document.getElementById('mood-error');
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.classList.remove('visible');
            }
        });
    });
}

/**
 * Initialize character count for notes
 */
function initCharacterCount() {
    const notesInput = document.getElementById('checkin-notes');
    const charCount = document.getElementById('notes-char-count');

    if (notesInput && charCount) {
        notesInput.addEventListener('input', () => {
            const count = notesInput.value.length;
            charCount.textContent = `${count} / 1000`;

            if (count > 900) {
                charCount.classList.add('warning');
            } else {
                charCount.classList.remove('warning');
            }
        });
    }
}

/**
 * Get check-in data from the form + client time metadata
 */
function getCheckinFormData() {
    const dateValue = document.getElementById('checkin-date')?.value || '';

    const base = {
        date: dateValue,
        memory_score: document.getElementById('memory-score')?.value || '',
        orientation_score: document.getElementById('orientation-score')?.value || '',
        activities_score: document.getElementById('activities-score')?.value || '',
        mood: document.getElementById('mood')?.value || '',
        notes: document.getElementById('checkin-notes')?.value.trim() || ''
    };

    const timeMeta = getClientTimeMeta(dateValue);

    return {
        ...base,
        ...timeMeta
    };
}

/**
 * Validate check-in form data with field-level errors
 */
function validateCheckinData(data) {
    clearFieldErrors();
    let isValid = true;

    if (!data.date) {
        showFieldError('checkin-date', 'Please select a date');
        isValid = false;
    }

    if (!data.memory_score) {
        showFieldError('memory-score', 'Please select a memory score');
        isValid = false;
    }

    if (!data.orientation_score) {
        showFieldError('orientation-score', 'Please select an orientation score');
        isValid = false;
    }

    if (!data.activities_score) {
        showFieldError('activities-score', 'Please select a daily activities score');
        isValid = false;
    }

    if (!data.mood) {
        showFieldError('mood', 'Please select a mood');
        isValid = false;
    }

    return isValid;
}

/**
 * Reset the check-in form
 */
function resetCheckinForm() {
    const dateInput = document.getElementById('checkin-date');
    if (dateInput) dateInput.value = getTodayDate();

    ['memory-score-buttons', 'orientation-score-buttons', 'activities-score-buttons'].forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            container.querySelectorAll('.score-btn').forEach(btn => {
                btn.classList.remove('selected');
                btn.setAttribute('aria-checked', 'false');
            });
        }
    });

    ['memory-score', 'orientation-score', 'activities-score', 'mood'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });

    const moodContainer = document.getElementById('mood-buttons');
    if (moodContainer) {
        moodContainer.querySelectorAll('.mood-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.setAttribute('aria-checked', 'false');
        });
    }

    const notesInput = document.getElementById('checkin-notes');
    if (notesInput) notesInput.value = '';

    const charCount = document.getElementById('notes-char-count');
    if (charCount) {
        charCount.textContent = '0 / 1000';
        charCount.classList.remove('warning');
    }

    clearFieldErrors();
}

/**
 * Handle check-in form submission
 */
async function handleCheckinSubmit(e) {
    e.preventDefault();

    const button = document.getElementById('submit-checkin-btn');
    const messageContainer = document.getElementById('checkin-message');

    if (messageContainer) messageContainer.hidden = true;
    hideGlobalNotifications();

    if (!navigator.onLine) {
        showGlobalError('You appear to be offline. Please check your internet connection and try again.');
        return;
    }

    const data = getCheckinFormData();

    if (!validateCheckinData(data)) {
        showGlobalError('Please fill in all required fields.');
        return;
    }

    const loadingText = button?.querySelector('.loading-text');
    if (loadingText) loadingText.textContent = 'Saving...';

    setButtonLoading(button, true);
    showAIProcessingOverlay();

    try {
        if (loadingText) loadingText.textContent = 'Analyzing...';

        const checkin = await createCheckin(data);

        hideAIProcessingOverlay();

        showMessage('checkin-message', 'Check-in saved successfully!', 'success');
        showGlobalSuccess('Check-in saved! AI feedback is ready below.');

        displayAIFeedback(checkin);

        state.checkins.unshift(checkin);
        renderCheckinHistory();
        updateHistoryStats();

        resetCheckinForm();

        const feedbackSection = document.getElementById('ai-feedback-section');
        if (feedbackSection && !feedbackSection.hidden) {
            feedbackSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

    } catch (error) {
        console.error('Failed to create check-in:', error);
        hideAIProcessingOverlay();
        showMessage('checkin-message', error.message || 'Failed to save check-in', 'error');
        showGlobalError('Failed to save check-in: ' + error.message);
    } finally {
        setButtonLoading(button, false);
        if (loadingText) loadingText.textContent = 'Saving...';
    }
}

// =============================================================================
// AI Feedback Display
// =============================================================================

/**
 * Display AI feedback in the feedback section
 */
function displayAIFeedback(checkin) {
    const section = document.getElementById('ai-feedback-section');
    const dateEl = document.getElementById('feedback-date');
    const badge = document.getElementById('feedback-risk-badge');
    const summary = document.getElementById('feedback-summary');
    const suggestionsList = document.getElementById('feedback-suggestions-list');
    const disclaimer = document.getElementById('feedback-disclaimer');

    if (!section) return;

    if (dateEl) {
        dateEl.textContent = `Check-in for ${formatDate(checkin.date)}`;
    }

    const riskClass = getRiskClass(checkin.ai_risk_level);
    if (badge) {
        badge.className = `risk-badge ${riskClass}`;
        badge.textContent = getRiskText(checkin.ai_risk_level, checkin.ai_status);
    }

    if (summary) {
        if (checkin.ai_summary) {
            summary.textContent = checkin.ai_summary;
        } else if (checkin.ai_status === 'error') {
            summary.textContent = checkin.ai_error_message || 'AI feedback is temporarily unavailable.';
        } else {
            summary.textContent = 'Processing...';
        }
    }

    if (suggestionsList) {
        suggestionsList.innerHTML = '';
        if (checkin.ai_suggestions && checkin.ai_suggestions.length > 0) {
            checkin.ai_suggestions.forEach(suggestion => {
                const li = document.createElement('li');
                li.textContent = suggestion;
                suggestionsList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'No specific suggestions at this time.';
            suggestionsList.appendChild(li);
        }
    }

    if (disclaimer) {
        disclaimer.textContent = checkin.ai_disclaimer ||
            'This feedback is for informational purposes only and is not a medical diagnosis. Please consult a licensed healthcare professional for any concerns.';
    }

    section.hidden = false;
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Hide AI feedback section
 */
function hideAIFeedback() {
    const section = document.getElementById('ai-feedback-section');
    if (section) section.hidden = true;
}

// =============================================================================
// History Management with Templates
// =============================================================================

/**
 * Show history loading state with skeleton
 */
function showHistoryLoading() {
    const loadingEl = document.getElementById('history-loading');
    const emptyEl = document.getElementById('history-empty');
    const errorEl = document.getElementById('history-error');
    const listEl = document.getElementById('history-list');
    const statsEl = document.getElementById('history-stats');

    if (loadingEl) loadingEl.hidden = false;
    if (emptyEl) emptyEl.hidden = true;
    if (errorEl) errorEl.hidden = true;
    if (listEl) listEl.hidden = true;
    if (statsEl) statsEl.hidden = true;
}

/**
 * Show history error state
 */
function showHistoryError(message = 'Failed to load history') {
    const loadingEl = document.getElementById('history-loading');
    const emptyEl = document.getElementById('history-empty');
    const errorEl = document.getElementById('history-error');
    const listEl = document.getElementById('history-list');
    const statsEl = document.getElementById('history-stats');

    if (loadingEl) loadingEl.hidden = true;
    if (emptyEl) emptyEl.hidden = true;
    if (errorEl) errorEl.hidden = false;
    if (listEl) listEl.hidden = true;
    if (statsEl) statsEl.hidden = true;

    const errorDesc = document.querySelector('#history-error .error-description');
    if (errorDesc) {
        errorDesc.textContent = message;
    }
}

/**
 * Render the check-in history list using templates
 */
function renderCheckinHistory() {
    const loadingEl = document.getElementById('history-loading');
    const emptyEl = document.getElementById('history-empty');
    const errorEl = document.getElementById('history-error');
    const listEl = document.getElementById('history-list');
    const statsEl = document.getElementById('history-stats');

    if (loadingEl) loadingEl.hidden = true;
    if (errorEl) errorEl.hidden = true;

    if (state.checkins.length === 0) {
        if (emptyEl) emptyEl.hidden = false;
        if (listEl) listEl.hidden = true;
        if (statsEl) statsEl.hidden = true;
        return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (listEl) listEl.hidden = false;
    if (statsEl) statsEl.hidden = false;

    const template = document.getElementById('history-item-template');

    if (!listEl) return;
    listEl.innerHTML = '';

    state.checkins.forEach(checkin => {
        let item;

        if (template) {
            item = template.content.cloneNode(true);
            const article = item.querySelector('.history-item');

            article.dataset.id = checkin._id;
            article.setAttribute('aria-label', `View check-in details for ${formatDate(checkin.date)}`);

            const dateEl = article.querySelector('.history-date');
            if (dateEl) dateEl.textContent = formatDate(checkin.date);

            const riskBadge = article.querySelector('.history-risk-badge');
            if (riskBadge) {
                const riskClass = getRiskClass(checkin.ai_risk_level);
                riskBadge.className = `history-risk-badge ${riskClass}`;
                riskBadge.textContent = getRiskText(checkin.ai_risk_level, checkin.ai_status);
            }

            const memoryVal = article.querySelector('.memory-value');
            const orientVal = article.querySelector('.orientation-value');
            const actVal = article.querySelector('.activities-value');

            if (memoryVal) memoryVal.textContent = `${checkin.memory_score}/5`;
            if (orientVal) orientVal.textContent = `${checkin.orientation_score}/5`;
            if (actVal) actVal.textContent = `${checkin.activities_score}/5`;

            const moodEl = article.querySelector('.history-mood');
            if (moodEl) moodEl.textContent = `${getMoodEmoji(checkin.mood)} ${checkin.mood}`;

            const notesPreview = article.querySelector('.history-notes-preview');
            if (notesPreview) {
                if (checkin.notes && checkin.notes.trim()) {
                    notesPreview.textContent = truncateText(checkin.notes, 60);
                    notesPreview.hidden = false;
                } else {
                    notesPreview.hidden = true;
                }
            }

            article.addEventListener('click', () => openCheckinDetail(checkin._id));
            article.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openCheckinDetail(checkin._id);
                }
            });
        } else {
            // Fallback if no template
            const riskClass = getRiskClass(checkin.ai_risk_level);
            const riskText = getRiskText(checkin.ai_risk_level, checkin.ai_status);

            const div = document.createElement('div');
            div.className = 'history-item';
            div.dataset.id = checkin._id;
            div.tabIndex = 0;
            div.setAttribute('role', 'button');
            div.setAttribute('aria-label', `View check-in details for ${formatDate(checkin.date)}`);
            div.innerHTML = `
                <div class="history-item-header">
                    <span class="history-date">${formatDate(checkin.date)}</span>
                    <span class="history-risk-badge ${riskClass}">${riskText}</span>
                </div>
                <div class="history-scores">
                    <span class="history-score">
                        <span class="history-score-label">Memory:</span>
                        <span class="history-score-value">${checkin.memory_score}/5</span>
                    </span>
                    <span class="history-score">
                        <span class="history-score-label">Orient:</span>
                        <span class="history-score-value">${checkin.orientation_score}/5</span>
                    </span>
                    <span class="history-score">
                        <span class="history-score-label">Activities:</span>
                        <span class="history-score-value">${checkin.activities_score}/5</span>
                    </span>
                    <span class="history-mood">${getMoodEmoji(checkin.mood)} ${checkin.mood}</span>
                </div>
            `;

            div.addEventListener('click', () => openCheckinDetail(checkin._id));
            div.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openCheckinDetail(checkin._id);
                }
            });

            item = div;
        }

        listEl.appendChild(item);
    });
}

/**
 * Update history statistics
 */
function updateHistoryStats() {
    if (state.checkins.length === 0) return;

    const totalEl = document.getElementById('stat-total-checkins');
    const avgMemoryEl = document.getElementById('stat-avg-memory');
    const trendEl = document.getElementById('stat-recent-trend');

    if (totalEl) {
        totalEl.textContent = state.checkins.length;
    }

    if (avgMemoryEl) {
        const avgMemory = state.checkins.reduce((sum, c) => sum + c.memory_score, 0) / state.checkins.length;
        avgMemoryEl.textContent = avgMemory.toFixed(1);
    }

    if (trendEl) {
        const sorted = [...state.checkins].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
        );

        if (sorted.length >= 6) {
            const previous3 = sorted.slice(-6, -3);
            const recent3 = sorted.slice(-3);

            const avg = arr =>
                arr.reduce((sum, c) =>
                    sum + c.memory_score + c.orientation_score + c.activities_score,
                    0) / (arr.length * 3);

            const previousAvg = avg(previous3);
            const recentAvg = avg(recent3);

            if (recentAvg > previousAvg + 0.2) {
                trendEl.textContent = '↑ Improving';
                trendEl.className = 'stat-value trend-up';
            } else if (recentAvg < previousAvg - 0.2) {
                trendEl.textContent = '↓ Declining';
                trendEl.className = 'stat-value trend-down';
            } else {
                trendEl.textContent = '→ Stable';
                trendEl.className = 'stat-value trend-stable';
            }
        } else {
            trendEl.textContent = 'Need more data';
            trendEl.className = 'stat-value';
        }
    }
}

// =============================================================================
// Detail Modal
// =============================================================================

/**
 * Open check-in detail modal
 */
async function openCheckinDetail(checkinId) {
    const modal = document.getElementById('detail-modal');
    const modalBody = document.getElementById('modal-body');
    const modalTitle = document.getElementById('modal-title');

    if (!modal || !modalBody) return;

    let checkin = state.checkins.find(c => c._id === checkinId);

    if (!checkin) {
        try {
            checkin = await loadCheckinDetail(checkinId);
        } catch (error) {
            console.error('Failed to load check-in detail:', error);
            showGlobalError('Failed to load check-in details');
            return;
        }
    }

    state.selectedCheckin = checkin;

    if (modalTitle) {
        modalTitle.textContent = `Check-in: ${formatDate(checkin.date)}`;
    }

    const template = document.getElementById('modal-detail-template');

    if (template) {
        const content = template.content.cloneNode(true);

        const riskBadge = content.querySelector('.modal-risk-badge');
        if (riskBadge) {
            const riskClass = getRiskClass(checkin.ai_risk_level);
            riskBadge.className = `risk-badge modal-risk-badge ${riskClass}`;
            riskBadge.textContent = getRiskText(checkin.ai_risk_level, checkin.ai_status);
        }

        const memoryCircle = content.querySelector('.memory-circle');
        const orientCircle = content.querySelector('.orientation-circle');
        const actCircle = content.querySelector('.activities-circle');

        if (memoryCircle) {
            memoryCircle.querySelector('.value').textContent = `${checkin.memory_score}/5`;
            memoryCircle.classList.add(`score-${checkin.memory_score}`);
        }
        if (orientCircle) {
            orientCircle.querySelector('.value').textContent = `${checkin.orientation_score}/5`;
            orientCircle.classList.add(`score-${checkin.orientation_score}`);
        }
        if (actCircle) {
            actCircle.querySelector('.value').textContent = `${checkin.activities_score}/5`;
            actCircle.classList.add(`score-${checkin.activities_score}`);
        }

        const moodEl = content.querySelector('.modal-mood');
        if (moodEl) moodEl.textContent = `${getMoodEmoji(checkin.mood)} ${checkin.mood}`;

        const notesSection = content.querySelector('.notes-section');
        const notesEl = content.querySelector('.modal-notes');
        if (notesSection && notesEl) {
            if (checkin.notes && checkin.notes.trim()) {
                notesSection.hidden = false;
                notesEl.textContent = checkin.notes;
            } else {
                notesSection.hidden = true;
            }
        }

        const summaryEl = content.querySelector('.modal-summary');
        if (summaryEl) {
            summaryEl.textContent = checkin.ai_summary || 'No AI summary available.';
        }

        const suggestionsSection = content.querySelector('.suggestions-section');
        const suggestionsList = content.querySelector('.modal-suggestions');
        if (suggestionsSection && suggestionsList) {
            if (checkin.ai_suggestions && checkin.ai_suggestions.length > 0) {
                suggestionsSection.hidden = false;
                suggestionsList.innerHTML = '';
                checkin.ai_suggestions.forEach(s => {
                    const li = document.createElement('li');
                    li.textContent = s;
                    suggestionsList.appendChild(li);
                });
            } else {
                suggestionsSection.hidden = true;
            }
        }

        const disclaimerEl = content.querySelector('.modal-disclaimer');
        if (disclaimerEl) {
            disclaimerEl.textContent = checkin.ai_disclaimer ||
                'This feedback is for informational purposes only and is not a medical diagnosis.';
        }

        modalBody.innerHTML = '';
        modalBody.appendChild(content);
    } else {
        // Fallback rendering
        const riskClass = getRiskClass(checkin.ai_risk_level);
        const riskText = getRiskText(checkin.ai_risk_level, checkin.ai_status);

        modalBody.innerHTML = `
            <div class="modal-section">
                <div class="risk-badge-container">
                    <span class="risk-badge ${riskClass}">${riskText}</span>
                </div>
            </div>
            
            <div class="modal-section">
                <h4>Scores</h4>
                <div class="modal-scores">
                    <div class="modal-score-item">
                        <div class="value">${checkin.memory_score}/5</div>
                        <div class="label">Memory</div>
                    </div>
                    <div class="modal-score-item">
                        <div class="value">${checkin.orientation_score}/5</div>
                        <div class="label">Orientation</div>
                    </div>
                    <div class="modal-score-item">
                        <div class="value">${checkin.activities_score}/5</div>
                        <div class="label">Activities</div>
                    </div>
                </div>
            </div>
            
            <div class="modal-section">
                <h4>Mood</h4>
                <p>${getMoodEmoji(checkin.mood)} ${checkin.mood}</p>
            </div>
            
            ${checkin.notes ? `
            <div class="modal-section">
                <h4>Notes</h4>
                <div class="modal-notes">${escapeHtml(checkin.notes)}</div>
            </div>
            ` : ''}
            
            <div class="modal-section">
                <h4>AI Summary</h4>
                <div class="feedback-summary">${escapeHtml(checkin.ai_summary || 'No AI summary available.')}</div>
            </div>
            
            ${checkin.ai_suggestions && checkin.ai_suggestions.length > 0 ? `
            <div class="modal-section">
                <h4>Suggestions</h4>
                <ul class="feedback-suggestions">
                    ${checkin.ai_suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
            
            <div class="modal-section">
                <div class="feedback-disclaimer">${escapeHtml(checkin.ai_disclaimer || 'This feedback is for informational purposes only and is not a medical diagnosis.')}</div>
            </div>
        `;
    }

    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    const closeBtn = modal.querySelector('.btn-close');
    if (closeBtn) closeBtn.focus();
}

/**
 * Close the detail modal
 */
function closeModal() {
    const modal = document.getElementById('detail-modal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
    state.selectedCheckin = null;
}

/**
 * Close help modal
 */
function closeHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
}

/**
 * Open help modal
 */
function openHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) {
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
    }
}

// =============================================================================
// Event Listeners & Initialization
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize font size toggle
    initFontSizeToggle();

    // Initialize forms
    initCheckinForm();

    // Load initial data
    loadProfile();
    showHistoryLoading();
    loadCheckins();

    // Global notification dismiss buttons
    document.querySelector('#global-error .error-dismiss')?.addEventListener('click', () => {
        document.getElementById('global-error').hidden = true;
    });

    document.querySelector('#global-success .success-dismiss')?.addEventListener('click', () => {
        document.getElementById('global-success').hidden = true;
    });

    // Profile form events
    document.getElementById('profile-form')?.addEventListener('submit', handleProfileSubmit);
    document.getElementById('toggle-profile')?.addEventListener('click', toggleProfileSection);

    // Check-in form events
    document.getElementById('checkin-form')?.addEventListener('submit', handleCheckinSubmit);

    // AI feedback events
    document.getElementById('close-feedback')?.addEventListener('click', hideAIFeedback);

    // History events
    document.getElementById('refresh-history')?.addEventListener('click', () => {
        showHistoryLoading();
        loadCheckins();
    });

    document.getElementById('retry-history')?.addEventListener('click', () => {
        showHistoryLoading();
        loadCheckins();
    });

    // Modal events
    document.getElementById('close-modal')?.addEventListener('click', closeModal);
    document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
    document.getElementById('detail-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'detail-modal') {
            closeModal();
        }
    });

    // Help modal events
    document.getElementById('show-help')?.addEventListener('click', (e) => {
        e.preventDefault();
        openHelpModal();
    });

    document.getElementById('close-help-modal')?.addEventListener('click', closeHelpModal);
    document.getElementById('help-modal-close-btn')?.addEventListener('click', closeHelpModal);
    document.getElementById('help-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'help-modal') {
            closeHelpModal();
        }
    });

    // About link
    document.getElementById('show-about')?.addEventListener('click', (e) => {
        e.preventDefault();
        showGlobalSuccess('Elderly Companion v1.0 - A caregiving support tool. Not a medical device.');
    });

    // Keyboard events for modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const detailModal = document.getElementById('detail-modal');
            const helpModal = document.getElementById('help-modal');

            if (detailModal && !detailModal.hidden) {
                closeModal();
            }
            if (helpModal && !helpModal.hidden) {
                closeHelpModal();
            }
        }
    });
});
