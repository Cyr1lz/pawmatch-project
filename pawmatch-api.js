
// Updated: Now uses Supabase instead of local backend (localhost:3000)
// Date: January 2026 – production-ready version

// ──────────────────────────────────────────────────────────────
//          REPLACE THESE TWO LINES WITH YOUR REAL VALUES
const SUPABASE_URL    = 'https://shsoiykrvvnqvtampezs.supabase.co';           // ← from Supabase → Settings → API
const SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc29peWtydnZucXZ0YW1wZXpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NTI2OTEsImV4cCI6MjA4NTQyODY5MX0.jLaJSOLqCDcZ6PT0tF-BRN3drqK4Lmym5nXI_61j0dQ';      // ← anon public key
// ──────────────────────────────────────────────────────────────

const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// State
let petsDatabase = [];
let favorites = [];
let comparePets = [];
let currentFilters = {
    category: '',
    location: '',
    age: '',
    size: '',
    gender: ''
};

// Utility
function escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[m]);
}

// ─── Fetch pets from Supabase ──────────────────────────────────
async function fetchPets() {
    try {
        const { data, error } = await supabase
            .from('pets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        petsDatabase = data || [];
    } catch (err) {
        console.error('Supabase fetch error:', err.message);
        showToast('⚠️', 'Could not load pets — please try again later');
        petsDatabase = [];
    }
}

async function fetchFavorites() {
    try {
        const saved = localStorage.getItem('pawmatch-favorites');
        favorites = saved ? JSON.parse(saved) : [];
    } catch {
        favorites = [];
    }
}

async function saveFavorites() {
    localStorage.setItem('pawmatch-favorites', JSON.stringify(favorites));
}

// ─── Initialization ─────────────────────────────────────────────
async function init() {
    showLoading();
    await Promise.all([fetchPets(), fetchFavorites()]);
    renderPets(petsDatabase);
    updateFavoriteCount();
    hideLoading();
}

function showLoading() {
    const grid = document.getElementById('petsGrid');
    if (grid) {
        grid.innerHTML = '<div class="loading active"><div class="loading-spinner"></div><p>Loading adorable pets...</p></div>';
    }
}

function hideLoading() {
    const loading = document.querySelector('.loading');
    if (loading) loading.remove();
}

// ─── Render pets (updated for Supabase fields) ─────────────────
function renderPets(pets) {
    const grid = document.getElementById('petsGrid');
    const noResults = document.getElementById('noResults');

    if (!grid) return;

    grid.innerHTML = '';

    if (pets.length === 0) {
        noResults?.classList.add('active');
    } else {
        noResults?.classList.remove('active');

        pets.forEach(pet => {
            const isFavorited = favorites.includes(pet.id);
            const isComparing = comparePets.includes(pet.id);

            const petCard = `
                <div class="pet-card" data-id="${pet.id}" onclick="showPetModal('${pet.id}')">
                    <div class="pet-image" style="background: ${pet.gradient || 'linear-gradient(135deg, #FFD6E8, #C9E4FF)'}">
                        <div class="favorite-icon ${isFavorited ? 'favorited' : ''}" onclick="toggleFavorite(event, '${pet.id}')">
                            ${isFavorited ? '❤️' : '♡'}
                        </div>
                        ${pet.image_url ?
                            `<img src="${escapeHTML(pet.image_url)}" alt="${escapeHTML(pet.name)}" loading="lazy">` :
                            `<span>${pet.emoji || '🐾'}</span>`
                        }
                        ${pet.badge ? `<div class="pet-badge">${escapeHTML(pet.badge)}</div>` : ''}
                    </div>
                    <div class="pet-info">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                            <h3 class="pet-name">${escapeHTML(pet.name)}</h3>
                            <label style="cursor: pointer; display: flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; color: #666;" onclick="event.stopPropagation();">
                                <input type="checkbox" ${isComparing ? 'checked' : ''} onchange="toggleCompare('${pet.id}')" style="cursor: pointer;">
                                Compare
                            </label>
                        </div>
                        <p class="pet-details">
                            ${escapeHTML(pet.breed)} • ${escapeHTML(pet.age)} • ${escapeHTML(pet.gender)}<br>
                            ${escapeHTML(pet.location)}
                        </p>
                        <div class="pet-tags">
                            ${(pet.personality || []).slice(0, 2).map(trait => `<span class="tag">${escapeHTML(trait)}</span>`).join('')}
                        </div>
                    </div>
                </div>
            `;
            grid.insertAdjacentHTML('beforeend', petCard);
        });
    }

    updateResultsCount(pets.length);
}

function updateResultsCount(count) {
    const el = document.getElementById('resultsCount');
    if (el) el.textContent = `Showing ${count} pet${count !== 1 ? 's' : ''}`;
}

// ─── Modal ──────────────────────────────────────────────────────
function showPetModal(petId) {
    const pet = petsDatabase.find(p => p.id === petId);
    if (!pet) return;

    const modal = document.getElementById('petModal');
    const modalContent = document.getElementById('modalContent');
    const isFavorited = favorites.includes(pet.id);

    modalContent.innerHTML = `
        <button class="modal-close" onclick="closeModal()">×</button>
        <div class="modal-header-img" style="background: ${pet.gradient || 'linear-gradient(135deg, #FFD6E8, #C9E4FF)'}">
            <div class="favorite-icon ${isFavorited ? 'favorited' : ''}" onclick="toggleFavorite(event, '${pet.id}')">
                ${isFavorited ? '❤️' : '♡'}
            </div>
            ${pet.image_url ?
                `<img src="${escapeHTML(pet.image_url)}" alt="${escapeHTML(pet.name)}">` :
                `<span>${pet.emoji || '🐾'}</span>`
            }
        </div>
        <div class="modal-body">
            <h2 class="modal-title">${escapeHTML(pet.name)}</h2>
            <p class="modal-subtitle">${escapeHTML(pet.breed)} • ${escapeHTML(pet.age)} • ${escapeHTML(pet.gender)}<br>📍 ${escapeHTML(pet.location)}</p>

            <div class="quick-stats">
                <div class="stat-item">
                    <div class="stat-number">${pet.age?.split(' ')[0] || '?'}</div>
                    <div class="stat-label">${pet.age_category === 'puppy' ? 'Months' : 'Years'} Old</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${pet.size_detail?.split(' ')[0] || '?'}</div>
                    <div class="stat-label">Size</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${pet.adoption_fee?.replace('$', '') || '?'}</div>
                    <div class="stat-label">Adoption Fee</div>
                </div>
            </div>

            <div class="modal-section">
                <h3>About ${escapeHTML(pet.name)}</h3>
                <p>${escapeHTML(pet.description || 'No description available.')}</p>
            </div>

            <div style="margin-bottom: 2rem;">
                <h3 style="font-size: 1.5rem; color: var(--primary-blue); margin-bottom: 1rem;">Personality Traits</h3>
                <div class="personality-grid">
                    ${(pet.personality || []).map(trait => `<span class="personality-tag">${escapeHTML(trait)}</span>`).join('') || '<em>No traits listed</em>'}
                </div>
            </div>

            <div class="info-grid">
                <div class="info-item">
                    <h4>Health Status</h4>
                    <p>${escapeHTML(pet.health || 'Not specified')}</p>
                </div>
                <div class="info-item">
                    <h4>Size</h4>
                    <p>${escapeHTML(pet.size_detail || 'Not specified')}</p>
                </div>
                <div class="info-item">
                    <h4>Good With</h4>
                    <p>${escapeHTML(pet.good_with || 'Not specified')}</p>
                </div>
                <div class="info-item">
                    <h4>Adoption Fee</h4>
                    <p style="font-weight: 600; color: var(--primary-orange);">${escapeHTML(pet.adoption_fee || 'Contact shelter')}</p>
                </div>
            </div>

            <div style="background: var(--soft-gray); padding: 1.5rem; border-radius: 20px; margin-bottom: 2rem;">
                <h4 style="font-size: 1.2rem; color: var(--primary-blue); margin-bottom: 0.5rem;">Shelter Information</h4>
                <p style="color: #666;">📍 ${escapeHTML(pet.shelter || 'Not listed')}</p>
            </div>

            <div class="alert-section">
                <h4>🔔 Get Notified About Similar Pets</h4>
                <p style="color: #666; font-size: 0.95rem; margin-bottom: 1rem;">
                    Subscribe to alerts for ${escapeHTML(pet.type?.toLowerCase() || 'pets')} like ${escapeHTML(pet.name)}
                </p>
                <div class="alert-input-group">
                    <input type="email" class="alert-input" placeholder="Enter your email" id="alertEmail">
                    <button class="alert-btn" onclick="subscribeToAlerts('${escapeHTML(pet.type || 'pet')}', '${escapeHTML(pet.name)}')">Subscribe</button>
                </div>
            </div>

            <button class="adopt-btn" onclick="startAdoption('${escapeHTML(pet.name)}')">
                💝 Start Adoption Application
            </button>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                <button class="share-btn" onclick="sharePet('${pet.id}')">
                    📤 Share ${escapeHTML(pet.name)}'s Profile
                </button>
                <button class="share-btn" style="background: var(--accent-pink);" onclick="printProfile('${pet.id}')">
                    🖨️ Print Profile
                </button>
            </div>
        </div>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('petModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ─── Favorites ──────────────────────────────────────────────────
async function toggleFavorite(event, petId) {
    event.stopPropagation();

    const index = favorites.indexOf(petId);
    if (index > -1) {
        favorites.splice(index, 1);
        showToast('💔', 'Removed from favorites');
    } else {
        favorites.push(petId);
        showToast('❤️', 'Added to favorites!');
    }

    await saveFavorites();
    updateFavoriteCount();

    // Update all heart icons for this pet
    document.querySelectorAll(`[onclick*="toggleFavorite(event, '${petId}']"]`).forEach(icon => {
        const isFav = favorites.includes(petId);
        icon.classList.toggle('favorited', isFav);
        icon.innerHTML = isFav ? '❤️' : '♡';
    });
}

function updateFavoriteCount() {
    const countEl = document.getElementById('favCount');
    if (countEl) countEl.textContent = favorites.length;
}

// ─── The rest of your original functions remain unchanged ──────
// (showFavorites, filterByCategory, searchByLocation, applyFilters, resetAllFilters,
// startAdoption, scrollToSection, toggleCompare, updateCompareBar, removeFromCompare,
// showComparison, clearComparison, sharePet, copyToClipboard, printProfile,
// subscribeToAlerts, showToast, hideToast)

function showFavorites() {
    if (favorites.length === 0) {
        showToast('💭', 'No favorites yet! Click the heart on pet cards to add.');
        return;
    }

    const favoritePets = petsDatabase.filter(pet => favorites.includes(pet.id));
    renderPets(favoritePets);
    scrollToSection('featured-section');

    document.querySelectorAll('.category-card').forEach(card => card.classList.remove('active'));

    currentFilters = { category: '', location: '', age: '', size: '', gender: '' };
}

// ... (keep all other functions exactly as they were) ...

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('petModal');
    if (modal) {
        modal.addEventListener('click', e => {
            if (e.target === modal) closeModal();
        });
    }

    const locSearch = document.getElementById('locationSearch');
    if (locSearch) {
        locSearch.addEventListener('keypress', e => {
            if (e.key === 'Enter') searchByLocation();
        });
    }

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
    });
});

window.addEventListener('load', init);