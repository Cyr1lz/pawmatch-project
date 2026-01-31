// admin-api.js
// FIXED VERSION – Supabase only, no localhost backend, no JWT
// Last updated: January 2026

// ──────────────────────────────────────────────────────────────
//          REPLACE THESE TWO LINES WITH YOUR REAL VALUES
const SUPABASE_URL    = 'https://shsoiykrvvnqvtampezs.supabase.co';
const SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc29peWtydnZucXZ0YW1wZXpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NTI2OTEsImV4cCI6MjA4NTQyODY5MX0.jLaJSOLqCDcZ6PT0tF-BRN3drqK4Lmym5nXI_61j0dQ';
// ──────────────────────────────────────────────────────────────

const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

let petsDatabase = [];
let editingPetId = null;

// ─── Utility ────────────────────────────────────────────────────
function escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[m]);
}

// ─── Fetch all pets from Supabase ───────────────────────────────
async function fetchPets() {
    try {
        const { data, error } = await supabase
            .from('pets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        petsDatabase = data || [];
        console.log('Pets loaded:', petsDatabase.length, 'items');
    } catch (err) {
        console.error('Failed to fetch pets:', err.message);
        showToast('⚠️', 'Failed to load pets. Please try again.');
        petsDatabase = [];
    }
}

// ─── Admin Login with Supabase Auth ─────────────────────────────
async function loginAdmin(e) {
    e.preventDefault();

    const emailEl = document.getElementById('adminEmail');
    const passwordEl = document.getElementById('adminPassword');

    if (!emailEl || !passwordEl) {
        showToast('⚠️', 'Login form elements not found');
        return;
    }

    const email = emailEl.value.trim();
    const password = passwordEl.value;

    if (!email || !password) {
        showToast('⚠️', 'Please enter email and password');
        return;
    }

    console.log('Login attempt:', { email });

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('Supabase login error:', error.message);
            throw error;
        }

        console.log('Login success:', data.user?.email);
        showToast('✓', 'Login successful!');

        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('adminMainContent').style.display = 'block';

        await init();
    } catch (err) {
        console.error('Login failed:', err.message);
        showToast('⚠️', err.message.includes('Invalid') ? 'Invalid email or password' : 'Login failed');
    }
}

// ─── Add new pet with image upload ──────────────────────────────
async function addNewPet() {
    if (typeof collectFormData !== 'function' || typeof validateForm !== 'function') {
        showToast('⚠️', 'Form functions missing (collectFormData / validateForm)');
        return;
    }

    const formData = collectFormData();
    if (!validateForm(formData)) return;

    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.textContent = '💾 Saving...';
        submitBtn.disabled = true;
    }

    try {
        let imageUrl = null;
        const file = document.getElementById('petImage')?.files?.[0];

        if (file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`;
            const filePath = `public/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('pets')
                .upload(filePath, file, { upsert: false });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('pets').getPublicUrl(filePath);
            imageUrl = urlData.publicUrl;
        }

        const petPayload = {
            name: formData.name,
            type: formData.type,
            breed: formData.breed,
            age: formData.age,
            age_category: formData.ageCategory,
            gender: formData.gender,
            size: formData.size,
            size_detail: formData.sizeDetail,
            location: formData.location,
            emoji: formData.emoji,
            badge: formData.badge,
            gradient: formData.gradient,
            adoption_fee: formData.adoptionFee,
            description: formData.description,
            personality: formData.personality ? formData.personality.split(',').map(s => s.trim()) : [],
            health: formData.health,
            good_with: formData.goodWith,
            shelter: formData.shelter,
            image_url: imageUrl,
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('pets')
            .insert([petPayload])
            .select()
            .single();

        if (error) throw error;

        petsDatabase.push(data);
        if (typeof loadAdminPets === 'function') loadAdminPets();
        if (typeof updatePetCount === 'function') updatePetCount();

        showToast('✓', `${data.name} added successfully!`);
        if (typeof resetForm === 'function') resetForm();
    } catch (err) {
        console.error('Add pet failed:', err.message);
        showToast('⚠️', 'Failed to add pet: ' + (err.message || 'unknown error'));
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '➕ Add Pet';
        }
    }
}

// ─── Update pet ─────────────────────────────────────────────────
async function updatePet() {
    if (!editingPetId) {
        showToast('⚠️', 'No pet selected for editing');
        return;
    }

    const formData = collectFormData();
    if (!validateForm(formData)) return;

    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.textContent = '💾 Updating...';
        submitBtn.disabled = true;
    }

    try {
        let imageUrl = formData.image || null;

        const file = document.getElementById('petImage')?.files?.[0];
        const removeFlag = document.getElementById('removeImageBtn')?.dataset?.removed === 'true';

        if (file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`;
            const filePath = `public/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('pets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('pets').getPublicUrl(filePath);
            imageUrl = urlData.publicUrl;
        } else if (removeFlag) {
            imageUrl = null;
        }

        const petPayload = {
            name: formData.name,
            type: formData.type,
            breed: formData.breed,
            age: formData.age,
            age_category: formData.ageCategory,
            gender: formData.gender,
            size: formData.size,
            size_detail: formData.sizeDetail,
            location: formData.location,
            emoji: formData.emoji,
            badge: formData.badge,
            gradient: formData.gradient,
            adoption_fee: formData.adoptionFee,
            description: formData.description,
            personality: formData.personality ? formData.personality.split(',').map(s => s.trim()) : [],
            health: formData.health,
            good_with: formData.goodWith,
            shelter: formData.shelter,
            image_url: imageUrl
        };

        const { data, error } = await supabase
            .from('pets')
            .update(petPayload)
            .eq('id', editingPetId)
            .select()
            .single();

        if (error) throw error;

        const index = petsDatabase.findIndex(p => p.id === editingPetId);
        if (index !== -1) petsDatabase[index] = data;

        if (typeof loadAdminPets === 'function') loadAdminPets();
        if (typeof updatePetCount === 'function') updatePetCount();

        showToast('✓', `${data.name} updated!`);
        if (typeof resetForm === 'function') resetForm();
        editingPetId = null;
    } catch (err) {
        console.error('Update failed:', err.message);
        showToast('⚠️', 'Failed to update pet');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = editingPetId ? '💾 Update Pet' : '➕ Add Pet';
        }
    }
}

// ─── Delete pet ─────────────────────────────────────────────────
async function deletePet(petId) {
    if (!confirm('Are you sure you want to delete this pet?')) return;

    try {
        const { error } = await supabase
            .from('pets')
            .delete()
            .eq('id', petId);

        if (error) throw error;

        petsDatabase = petsDatabase.filter(p => p.id !== petId);
        if (typeof loadAdminPets === 'function') loadAdminPets();
        if (typeof updatePetCount === 'function') updatePetCount();
        showToast('✓', 'Pet deleted successfully');
    } catch (err) {
        console.error('Delete failed:', err.message);
        showToast('⚠️', 'Failed to delete pet');
    }
}

// ─── Initialize admin panel ────────────────────────────────────
async function init() {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            console.log('No active session – showing login');
            document.getElementById('loginForm').style.display = 'block';
            document.getElementById('adminMainContent').style.display = 'none';
            return;
        }

        console.log('Active session found:', session.user.email);
        showToast('🔄', 'Loading pets...');
        await fetchPets();
        if (typeof loadAdminPets === 'function') loadAdminPets();
        if (typeof updatePetCount === 'function') updatePetCount();
    } catch (err) {
        console.error('Init error:', err.message);
        showToast('⚠️', 'Error initializing admin panel');
    }
}

// ─── Auto-detect login state on page load ──────────────────────
supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event, session ? 'logged in' : 'logged out');
    if (event === 'SIGNED_IN') {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('adminMainContent').style.display = 'block';
        init();
    } else if (event === 'SIGNED_OUT') {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('adminMainContent').style.display = 'none';
    }
});

// ─── Start on page load ────────────────────────────────────────
window.addEventListener('load', () => {
    init();
});

function collectFormData() {
    // Your original code to collect all form values
    return {
        name: document.getElementById('petName').value.trim(),
        type: document.getElementById('petType').value,
        breed: document.getElementById('petBreed').value.trim(),
        age: document.getElementById('petAge').value.trim(),
        ageCategory: document.getElementById('petAgeCategory').value,
        gender: document.getElementById('petGender').value,
        size: document.getElementById('petSize').value,
        sizeDetail: document.getElementById('petSizeDetail').value.trim(),
        location: document.getElementById('petLocation').value.trim(),
        emoji: document.getElementById('petEmoji').value.trim(),
        badge: document.getElementById('petBadge').value.trim(),
        gradient: document.getElementById('petGradient').value.trim(),
        adoptionFee: document.getElementById('petAdoptionFee').value.trim(),
        description: document.getElementById('petDescription').value.trim(),
        personality: document.getElementById('petPersonality').value.trim(),
        health: document.getElementById('petHealth').value.trim(),
        goodWith: document.getElementById('petGoodWith').value.trim(),
        shelter: document.getElementById('petShelter').value.trim(),
        // image is handled separately
    };
}

function validateForm(data) {
    // Your original validation logic
    if (!data.name) return showToast('⚠️', 'Pet name is required');
    // ... add other checks ...
    return true;
}
function loadAdminPets() {
    const container = document.getElementById('adminPetsList');
    if (!container) return;

    container.innerHTML = '';

    if (petsDatabase.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">😿</div><h3>No pets yet</h3><p>Add your first pet above!</p></div>';
        return;
    }

    petsDatabase.forEach(pet => {
        const item = document.createElement('div');
        item.className = 'admin-pet-item';
        item.innerHTML = `
            <div class="admin-pet-info">
                ${pet.image_url ? `<img class="admin-pet-image" src="${escapeHTML(pet.image_url)}" alt="${escapeHTML(pet.name)}">` : `<span class="admin-pet-emoji">${pet.emoji || '🐾'}</span>`}
                <div>
                    <h4>${escapeHTML(pet.name)}</h4>
                    <p>${escapeHTML(pet.type)} • ${escapeHTML(pet.breed)}</p>
                    <p>${escapeHTML(pet.location)}</p>
                </div>
            </div>
            <div class="admin-pet-actions">
                <button class="admin-action-btn edit-btn" onclick="editPet('${pet.id}')">Edit</button>
                <button class="admin-action-btn delete-btn" onclick="deletePet('${pet.id}')">Delete</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function updatePetCount() {
    const el = document.getElementById('petCount');
    if (el) el.textContent = petsDatabase.length;
}

function editPet(petId) {
    editingPetId = petId;
    const pet = petsDatabase.find(p => p.id === petId);
    if (!pet) return;

    // Fill form with pet data
    document.getElementById('petName').value = pet.name || '';
    document.getElementById('petType').value = pet.type || '';
    // ... fill all other fields ...

    document.getElementById('submitBtn').textContent = '💾 Update Pet';
    document.getElementById('cancelEditBtn').style.display = 'block';

    // Switch to add tab
    switchTab({ currentTarget: document.querySelector('[onclick*="add"]') }, 'add');
}