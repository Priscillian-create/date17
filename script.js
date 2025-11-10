// Initialize Supabase with your configuration
const supabaseUrl = 'https://qgayglybnnrhobcvftrs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYXlnbHlibm5yaG9iY3ZmdHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2ODQ5ODMsImV4cCI6MjA3ODI2MDk4M30.dqiEe-v1cro5N4tuawu7Y1x5klSyjINsLHd9-V40QjQ';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Initialize data structures
const sections = ['grill', 'wholesale', 'building', 'food'];
const sectionNames = {
    'grill': 'Grill',
    'wholesale': 'Wholesale',
    'building': 'Building Material',
    'food': 'Food Supplies'
};

// Initialize empty inventory for each section
const inventory = {
    'grill': [],
    'wholesale': [],
    'building': [],
    'food': []
};

// Initialize empty carts for each section
const carts = {
    'grill': [],
    'wholesale': [],
    'building': [],
    'food': []
};

// Initialize sales data with proper default values
const salesData = {
    'grill': { total_sales: 0, total_transactions: 0, avg_transaction: 0, top_item: '-', dailySales: 0, dailyTransactions: 0 },
    'wholesale': { total_sales: 0, total_transactions: 0, avg_transaction: 0, top_item: '-', dailySales: 0, dailyTransactions: 0 },
    'building': { total_sales: 0, total_transactions: 0, avg_transaction: 0, top_item: '-', dailySales: 0, dailyTransactions: 0 },
    'food': { total_sales: 0, total_transactions: 0, avg_transaction: 0, top_item: '-', dailySales: 0, dailyTransactions: 0 }
};

// Initialize user data with proper default values
const userData = {
    'grill': { transactions: 0, sales: 0 },
    'wholesale': { transactions: 0, sales: 0 },
    'building': { transactions: 0, sales: 0 },
    'food': { transactions: 0, sales: 0 }
};

// Current section and view
let currentSection = 'grill';
let currentView = 'pos';
let currentFilter = 'all';
let currentUser = null;

// Load data from localStorage immediately on script load
function loadDataFromLocalStorage() {
    sections.forEach(section => {
        inventory[section] = loadFromLocalStorage(`inventory_${section}`, []);
        salesData[section] = loadFromLocalStorage(`salesData_${section}`, salesData[section]);
        userData[section] = loadFromLocalStorage(`userData_${section}`, userData[section]);
        carts[section] = loadFromLocalStorage(`cart_${section}`, []);
    });
}

// Call this immediately to load data from localStorage
loadDataFromLocalStorage();

// Generate unique ID for offline records
function generateOfflineId() {
    return 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Save data to local storage for offline use
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
}

// Load data from local storage
function loadFromLocalStorage(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.error('Error loading from localStorage:', e);
        return defaultValue;
    }
}

// Check if a product is expired
function isExpired(expiryDate) {
    if (!expiryDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    return expiry < today;
}

// Check if a product is expiring soon (within 7 days)
function isExpiringSoon(expiryDate) {
    if (!expiryDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 7;
}

// Get product status based on stock and expiry
function getProductStatus(item) {
    if (isExpired(item.expiry_date)) return 'expired';
    if (isExpiringSoon(item.expiry_date)) return 'expiring-soon';
    if (item.stock === 0) return 'out-of-stock';
    if (item.stock < 10) return 'low-stock';
    return 'in-stock';
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

// Update category inventory summary
function updateCategoryInventorySummary(section) {
    let totalProducts = 0;
    let totalValue = 0;
    let lowStockCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    
    inventory[section].forEach(item => {
        totalProducts++;
        totalValue += item.price * item.stock;
        const status = getProductStatus(item);
        if (status === 'low-stock') lowStockCount++;
        else if (status === 'expiring-soon') expiringSoonCount++;
        else if (status === 'expired') expiredCount++;
    });
    
    document.getElementById(`${section}-total-products`).textContent = totalProducts;
    document.getElementById(`${section}-total-value`).textContent = `₦${totalValue.toFixed(2)}`;
    document.getElementById(`${section}-low-stock-count`).textContent = lowStockCount;
    document.getElementById(`${section}-expiring-soon-count`).textContent = expiringSoonCount;
    document.getElementById(`${section}-expired-count`).textContent = expiredCount;
}

// ===================================================================
// --- MAJOR FIX: saveDataToSupabase ---
// ===================================================================
async function saveDataToSupabase(table, data, id = null) {
    // 1. Prepare data for local storage (includes client-only fields)
    const localData = {
        ...data,
        timestamp: new Date().toISOString(),
        userId: currentUser ? currentUser.id : 'offline_user',
        isOffline: !navigator.onLine || (id && id.startsWith('offline_')),
    };

    // 2. Save to local storage immediately
    const localKey = `${table}_${id || 'new'}`;
    saveToLocalStorage(localKey, localData);

    // 3. Update in-memory data structures and UI immediately (Optimistic UI)
    if (table === 'inventory') {
        if (!id) {
            id = generateOfflineId();
            localData.id = id;
            localData.isOffline = true;
            inventory[data.section].push(localData);
        } else {
            const index = inventory[data.section].findIndex(item => item.id === id);
            if (index !== -1) {
                inventory[data.section][index] = { ...inventory[data.section][index], ...localData };
            }
        }
        saveToLocalStorage(`inventory_${data.section}`, inventory[data.section]);
        loadInventoryTable(data.section);
        updateDepartmentStats(data.section);
        updateCategoryInventorySummary(data.section);
        updateTotalInventory();
    } 
    // --- FIX: Add optimistic updates for summary tables ---
    else if (table === 'sales_data') {
        const section = id; // For sales_data, 'id' is the section name
        if (section && salesData[section]) {
            salesData[section] = { ...salesData[section], ...data };
            saveToLocalStorage(`salesData_${section}`, salesData[section]);
            updateReports(section);
            updateDepartmentStats(section);
        }
    } 
    else if (table === 'user_data') {
        const section = id; // For user_data, 'id' is the section name
        if (section && userData[section]) {
            userData[section] = { ...userData[section], ...data };
            saveToLocalStorage(`userData_${section}`, userData[section]);
            updateUserStats(section);
        }
    }
    else if (table === 'sales') {
        // For sales records, we need to track them for syncing
        const salesRecords = loadFromLocalStorage('pending_sales', []);
        salesRecords.push(localData);
        saveToLocalStorage('pending_sales', salesRecords);
    }
    
    // 4. If online, attempt to sync with Supabase
    if (navigator.onLine) {
        try {
            console.log(`Syncing to Supabase table: ${table}`);
            const { isOffline, timestamp, userId, ...dataForSupabase } = localData;
            if (!id || id.startsWith('offline_')) {
                delete dataForSupabase.id;
            }
            
            let result;
            if (id && !id.startsWith('offline_')) {
                const { data: resultData, error } = await supabase.from(table).update(dataForSupabase).eq('id', id).select();
                if (error) throw error;
                result = resultData[0];
            } else {
                const { data: resultData, error } = await supabase.from(table).insert(dataForSupabase).select();
                if (error) throw error;
                result = resultData[0];
                if (table === 'inventory' && result) {
                    const index = inventory[data.section].findIndex(item => item.id === id);
                    if (index !== -1) {
                        inventory[data.section][index].id = result.id;
                        inventory[data.section][index].isOffline = false;
                        localStorage.removeItem(localKey);
                        saveToLocalStorage(`inventory_${data.section}`, inventory[data.section]);
                        loadInventoryTable(data.section);
                    }
                }
            }
            console.log(`Successfully synced to ${table}:`, result);
            return result;
        } catch (error) {
            console.error(`Error syncing to ${table}:`, error);
            showNotification(`Error saving to server. Changes kept locally.`, 'warning');
            return { id };
        }
    } else {
        console.log('Offline mode. Data saved locally.');
        showNotification('You are offline. Changes have been saved locally.', 'info');
        return { id };
    }
}

// NEW FUNCTION: Sync all pending offline data when coming back online
async function syncOfflineData() {
    if (!navigator.onLine) return;
    
    showNotification('Syncing offline data...', 'info');
    let syncCount = 0;
    
    try {
        // 1. Sync offline inventory items
        sections.forEach(section => {
            const offlineItems = inventory[section].filter(item => item.isOffline);
            offlineItems.forEach(async (item) => {
                try {
                    const { isOffline, timestamp, userId, ...dataForSupabase } = item;
                    delete dataForSupabase.id;
                    
                    const { data: resultData, error } = await supabase.from('inventory').insert(dataForSupabase).select();
                    if (error) throw error;
                    
                    if (resultData && resultData[0]) {
                        // Remove the offline item from the local inventory
                        const index = inventory[section].findIndex(i => i.id === item.id);
                        if (index !== -1) {
                            inventory[section].splice(index, 1);
                            syncCount++;
                        }
                    }
                } catch (error) {
                    console.error('Error syncing inventory item:', error);
                }
            });
            
            // Save the updated inventory
            saveToLocalStorage(`inventory_${section}`, inventory[section]);
            loadInventoryTable(section);
        });
        
        // 2. Sync pending sales
        const pendingSales = loadFromLocalStorage('pending_sales', []);
        for (const sale of pendingSales) {
            try {
                const { isOffline, timestamp, userId, ...dataForSupabase } = sale;
                
                const { data: resultData, error } = await supabase.from('sales').insert(dataForSupabase).select();
                if (error) throw error;
                
                if (resultData && resultData[0]) {
                    syncCount++;
                }
            } catch (error) {
                console.error('Error syncing sale:', error);
            }
        }
        
        // Clear pending sales after syncing
        if (pendingSales.length > 0) {
            saveToLocalStorage('pending_sales', []);
        }
        
        // 3. Sync sales_data and user_data for each section
        for (const section of sections) {
            try {
                // Sync sales data
                const { data: existingSalesData, error: salesError } = await supabase.from('sales_data').select('*').eq('id', section).single();
                
                if (!salesError && existingSalesData) {
                    // Update existing record
                    const { data: updatedData, error: updateError } = await supabase.from('sales_data').update(salesData[section]).eq('id', section);
                    if (updateError) throw updateError;
                } else {
                    // Insert new record
                    const { data: newData, error: insertError } = await supabase.from('sales_data').insert({ id: section, ...salesData[section] });
                    if (insertError) throw insertError;
                }
                
                // Sync user data
                const { data: existingUserData, error: userError } = await supabase.from('user_data').select('*').eq('id', section).single();
                
                if (!userError && existingUserData) {
                    // Update existing record
                    const { data: updatedData, error: updateError } = await supabase.from('user_data').update(userData[section]).eq('id', section);
                    if (updateError) throw updateError;
                } else {
                    // Insert new record
                    const { data: newData, error: insertError } = await supabase.from('user_data').insert({ id: section, ...userData[section] });
                    if (insertError) throw insertError;
                }
                
                syncCount++;
            } catch (error) {
                console.error(`Error syncing ${section} data:`, error);
            }
        }
        
        // Update all UI components after syncing
        sections.forEach(section => {
            updateReports(section);
            updateUserStats(section);
            updateDepartmentStats(section);
        });
        
        showNotification(`Successfully synced ${syncCount} items to the server.`, 'success');
    } catch (error) {
        console.error('Error during sync:', error);
        showNotification('Some data could not be synced. It will be kept locally.', 'warning');
    }
}

// Listen for authentication state changes
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        updateUserInfo(session.user);
        loadDataFromSupabase();
        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOfflineStatus);
        initializeApp();
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});

// Update user info in the UI
function updateUserInfo(user) {
    const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin User';
    const email = user.email || '';
    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase();
    document.getElementById('userName').textContent = displayName;
    document.getElementById('userAvatar').textContent = initials;
    sections.forEach(section => {
        document.getElementById(`${section}-profile-name`).textContent = displayName;
        document.getElementById(`${section}-profile-avatar`).textContent = initials;
        document.getElementById(`${section}-email`).value = email;
    });
}

// Handle online/offline status
function handleOnlineStatus() {
    document.getElementById('offlineIndicator').classList.remove('show');
    showNotification('Connection restored. Syncing data...', 'info');
    // First sync any pending offline data, then load fresh data from server
    syncOfflineData().then(() => {
        loadDataFromSupabase();
    });
}

function handleOfflineStatus() {
    document.getElementById('offlineIndicator').classList.add('show');
    showNotification('You\'re now offline. Changes will be saved locally.', 'warning');
}

// Load data from Supabase to update local state
async function loadDataFromSupabase() {
    if (!navigator.onLine) return;
    try {
        console.log('Loading data from Supabase...');
        sections.forEach(section => {
            supabase.from('inventory').select('*').eq('section', section).then(({ data, error }) => {
                if (error) { console.error(`Error loading ${section} inventory:`, error); return; }
                if (data) {
                    // Replace local inventory with server data (offline items have been removed during sync)
                    inventory[section] = data;
                    saveToLocalStorage(`inventory_${section}`, inventory[section]);
                    loadInventoryTable(section);
                    updateDepartmentStats(section);
                    updateCategoryInventorySummary(section);
                    updateTotalInventory();
                }
            });
            supabase.from('sales_data').select('*').eq('id', section).single().then(({ data, error }) => {
                if (!error && data) { 
                    // Replace with server data (local changes have been synced)
                    salesData[section] = data; 
                    saveToLocalStorage(`salesData_${section}`, salesData[section]); 
                    updateReports(section); 
                }
            });
            supabase.from('user_data').select('*').eq('id', section).single().then(({ data, error }) => {
                if (!error && data) { 
                    // Replace with server data (local changes have been synced)
                    userData[section] = data; 
                    saveToLocalStorage(`userData_${section}`, userData[section]); 
                    updateUserStats(section); 
                }
            });
        });
    } catch (error) { console.error('Error loading data from Supabase:', error); }
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', function() {
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            currentUser = session.user;
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            updateUserInfo(session.user);
            initializeApp();
            loadDataFromSupabase();
            window.addEventListener('online', handleOnlineStatus);
            window.addEventListener('offline', handleOfflineStatus);
        } else {
            document.getElementById('loginScreen').style.display = 'flex';
            document.getElementById('mainApp').style.display = 'none';
        }
    });
    
    document.getElementById('emailLoginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorElement = document.getElementById('email-login-error');
        document.getElementById('emailLoginBtn').disabled = true;
        document.getElementById('emailLoginBtn').textContent = 'Signing In...';
        supabase.auth.signInWithPassword({ email, password }).then(({ data, error }) => {
            if (error) { errorElement.textContent = error.message; document.getElementById('emailLoginBtn').disabled = false; document.getElementById('emailLoginBtn').textContent = 'Sign In'; }
        });
    });

    document.getElementById('logoutBtn').addEventListener('click', () => supabase.auth.signOut());
    document.getElementById('forgotPasswordLink').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('forgotPasswordModal').classList.add('active'); });

    document.querySelectorAll('.js-modal-close').forEach(button => {
        button.addEventListener('click', () => closeModal(button.getAttribute('data-target')));
    });

    document.querySelectorAll('.js-add-item-btn, .js-add-inventory-btn').forEach(button => {
        button.addEventListener('click', () => showAddInventoryModal(button.getAttribute('data-section')));
    });

    document.querySelectorAll('.js-checkout-btn').forEach(button => {
        button.addEventListener('click', () => processCheckout(button.getAttribute('data-section')));
    });

    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            const section = button.getAttribute('data-section');
            const filter = button.getAttribute('data-filter');
            if (!section) {
                document.querySelectorAll('.filter-btn:not([data-section])').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active'); currentFilter = filter; loadTotalInventoryTable(); return;
            }
            document.querySelectorAll(`[data-section="${section}"].filter-btn`).forEach(btn => btn.classList.remove('active'));
            button.classList.add('active'); currentFilter = filter; loadInventoryTable(section);
        });
    });

    document.querySelector('.js-add-inventory-confirm-btn').addEventListener('click', addNewInventory);
    document.querySelector('.js-update-inventory-btn').addEventListener('click', updateInventoryItem);
    document.querySelector('.js-complete-checkout-btn').addEventListener('click', completeCheckout);
    document.querySelector('.js-reset-password-btn').addEventListener('click', resetPassword);

    setupEventDelegation();
});

function setupEventDelegation() {
    document.querySelector('.nav-tabs').addEventListener('click', (e) => {
        const tab = e.target.closest('.nav-tab'); if (!tab) return;
        const section = tab.getAttribute('data-section');
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active');
        document.querySelectorAll('.section-container').forEach(s => s.classList.remove('active'));
        if (section === 'total-inventory') {
            document.getElementById('total-inventory-section').classList.add('active'); currentSection = 'total-inventory'; updateTotalInventory();
        } else {
            document.getElementById(`${section}-section`).classList.add('active'); currentSection = section; resetToPOSView(section);
        }
    });

    document.querySelectorAll('.sub-nav').forEach(nav => {
        nav.addEventListener('click', (e) => {
            const item = e.target.closest('.sub-nav-item'); if (!item) return;
            const view = item.getAttribute('data-view');
            const section = nav.closest('.section-container').id.replace('-section', '');
            document.querySelectorAll(`#${section}-section .sub-nav-item`).forEach(i => i.classList.remove('active')); item.classList.add('active');
            document.querySelectorAll(`#${section}-section .view-content`).forEach(v => v.classList.remove('active'));
            document.getElementById(`${section}-${view}-view`).classList.add('active');
            currentView = view;
            if (view === 'inventory') { loadInventoryTable(section); updateCategoryInventorySummary(section); }
            else if (view === 'reports') updateReports(section);
            else if (view === 'account') updateUserStats(section);
        });
    });

    document.querySelectorAll('.js-pos-search-results').forEach(container => {
        container.addEventListener('click', (e) => {
            const resultItem = e.target.closest('.pos-search-result-item'); if (!resultItem) return;
            const section = container.getAttribute('data-section');
            const itemId = resultItem.getAttribute('data-id');
            const item = inventory[section].find(invItem => invItem.id == itemId);
            if (item) {
                addToCart(section, item);
                const searchInput = document.querySelector(`.js-pos-search[data-section="${section}"]`);
                searchInput.value = '';
                container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-search"></i></div><h3 class="empty-state-title">Search for Products</h3><p class="empty-state-description">Type in the search box above to find products from your inventory.</p></div>`;
            }
        });
    });

    document.querySelectorAll('.js-pos-cart').forEach(cart => {
        cart.addEventListener('click', (e) => {
            const section = cart.getAttribute('data-section');
            if (e.target.closest('.quantity-btn')) {
                const btn = e.target.closest('.quantity-btn');
                const cartItem = btn.closest('.cart-item');
                const itemId = cartItem.getAttribute('data-item-id');
                if (btn.textContent === '+') incrementQuantity(section, itemId);
                else if (btn.textContent === '-') decrementQuantity(section, itemId);
            } else if (e.target.closest('.action-btn.delete')) {
                const btn = e.target.closest('.action-btn.delete');
                const cartItem = btn.closest('.cart-item');
                const itemId = cartItem.getAttribute('data-item-id');
                removeFromCart(section, itemId);
            }
        });
    });

    document.querySelectorAll('.js-inventory-container').forEach(container => {
        container.addEventListener('click', (e) => {
            const section = container.getAttribute('data-section');
            const btn = e.target.closest('.action-btn'); if (!btn) return;
            const row = btn.closest('tr');
            const itemId = row.getAttribute('data-item-id');
            if (btn.classList.contains('delete')) deleteInventoryItem(section, itemId);
            else editInventoryItem(section, itemId);
        });
    });
    
    document.querySelector('.js-total-inventory-container').addEventListener('click', (e) => {
        const btn = e.target.closest('.action-btn'); if (!btn) return;
        const row = btn.closest('tr');
        const itemId = row.getAttribute('data-item-id');
        const section = row.getAttribute('data-section');
        if (btn.classList.contains('delete')) deleteInventoryItem(section, itemId);
        else editInventoryItem(section, itemId);
    });
}

// --- FUNCTIONS ---
function initializeApp() {
    sections.forEach(section => {
        initializePOSSearch(section);
        updateCart(section);
        updateDepartmentStats(section);
        loadInventoryTable(section);
        updateReports(section);
        updateUserStats(section);
        updateCategoryInventorySummary(section);
        const form = document.getElementById(`${section}-account-form`);
        if (form) form.addEventListener('submit', (e) => { e.preventDefault(); saveAccountInfo(section); });
        const searchInput = document.querySelector(`.js-inventory-search[data-section="${section}"]`);
        if (searchInput) searchInput.addEventListener('input', () => filterInventory(section, searchInput.value));
    });
    updateTotalInventory();
}

function initializePOSSearch(section) {
    const searchInput = document.querySelector(`.js-pos-search[data-section="${section}"]`);
    const searchResults = document.querySelector(`.js-pos-search-results[data-section="${section}"]`);
    if (!searchInput) return;
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.trim().toLowerCase();
        if (searchTerm.length === 0) {
            searchResults.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-search"></i></div><h3 class="empty-state-title">Search for Products</h3><p class="empty-state-description">Type in the search box above to find products from your inventory.</p></div>`;
            return;
        }
        const filteredItems = inventory[section].filter(item => item.name.toLowerCase().includes(searchTerm));
        if (filteredItems.length === 0) {
            searchResults.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-search"></i></div><h3 class="empty-state-title">No Products Found</h3><p class="empty-state-description">Try a different search term or add new products to your inventory.</p></div>`;
        } else {
            searchResults.innerHTML = '';
            filteredItems.forEach(item => {
                const resultItem = document.createElement('div');
                resultItem.className = 'pos-search-result-item';
                resultItem.setAttribute('data-id', item.id);
                resultItem.innerHTML = `<div class="pos-item-info"><div class="pos-item-name">${item.name}</div><div class="pos-item-stock">Stock: ${item.stock}</div></div><div class="pos-item-price">₦${item.price.toFixed(2)}</div>`;
                searchResults.appendChild(resultItem);
            });
        }
    });
}

function updateCart(section) {
    const cartItemsContainer = document.querySelector(`.js-cart-items[data-section="${section}"]`);
    cartItemsContainer.innerHTML = ''; let subtotal = 0;
    if (carts[section].length === 0) {
        cartItemsContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-shopping-cart"></i></div><h3 class="empty-state-title">Your Cart is Empty</h3><p class="empty-state-description">Search for products to add to your cart.</p></div>`;
        document.querySelector(`.js-checkout-btn[data-section="${section}"]`).disabled = true;
    } else {
        carts[section].forEach(item => {
            const itemTotal = item.price * item.quantity; subtotal += itemTotal;
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item'; cartItem.setAttribute('data-item-id', item.id);
            cartItem.innerHTML = `<div class="cart-item-info"><div class="cart-item-name">${item.name}</div><div class="cart-item-details">₦${item.price.toFixed(2)} × ${item.quantity}</div></div><div class="cart-item-actions"><button class="quantity-btn">-</button><span>${item.quantity}</span><button class="quantity-btn">+</button><button class="action-btn delete"><i class="fas fa-trash"></i></button></div>`;
            cartItemsContainer.appendChild(cartItem);
        });
        document.querySelector(`.js-checkout-btn[data-section="${section}"]`).disabled = false;
    }
    document.querySelector(`.js-subtotal[data-section="${section}"]`).textContent = `₦${subtotal.toFixed(2)}`;
    document.querySelector(`.js-total[data-section="${section}"]`).textContent = `₦${subtotal.toFixed(2)}`;
}

function loadInventoryTable(section) {
    const inventoryContainer = document.querySelector(`.js-inventory-container[data-section="${section}"]`);
    inventoryContainer.innerHTML = '';
    const searchInput = document.querySelector(`.js-inventory-search[data-section="${section}"]`);
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let filteredItems = inventory[section].filter(item => {
        const statusMatch = currentFilter === 'all' || getProductStatus(item) === currentFilter;
        const searchMatch = !searchTerm || item.name.toLowerCase().includes(searchTerm);
        return statusMatch && searchMatch;
    });
    if (filteredItems.length === 0) {
        inventoryContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-warehouse"></i></div><h3 class="empty-state-title">${searchTerm ? 'No Products Found' : 'No Products in Inventory'}</h3><p class="empty-state-description">${searchTerm ? 'Try a different search term.' : 'Start by adding products to your inventory.'}</p><button class="btn btn-primary js-add-inventory-btn" data-section="${section}"><i class="fas fa-plus"></i> Add Your First Product</button></div>`;
        return;
    }
    const inventoryTable = document.createElement('table'); inventoryTable.className = 'inventory-table';
    inventoryTable.innerHTML = `<thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Expiry Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>${filteredItems.map(item => {
        const status = getProductStatus(item); let statusClass = '', statusText = '';
        if (status === 'in-stock') { statusClass = 'status-in-stock'; statusText = 'In Stock'; }
        else if (status === 'low-stock') { statusClass = 'status-low-stock'; statusText = 'Low Stock'; }
        else if (status === 'out-of-stock') { statusClass = 'status-out-of-stock'; statusText = 'Out of Stock'; }
        else if (status === 'expired') { statusClass = 'status-expired'; statusText = 'Expired'; }
        else if (status === 'expiring-soon') { statusClass = 'status-expiring-soon'; statusText = 'Expiring Soon'; }
        return `<tr data-item-id="${item.id}"><td>${item.name} ${item.isOffline ? '<i class="fas fa-wifi" style="color: #f39c12;" title="Pending sync"></i>' : ''}</td><td>₦${item.price.toFixed(2)}</td><td>${item.stock}</td><td>${formatDate(item.expiry_date)}</td><td><span class="status-badge ${statusClass}">${statusText}</span></td><td><button class="action-btn"><i class="fas fa-edit"></i></button><button class="action-btn delete"><i class="fas fa-trash"></i></button></td></tr>`;
    }).join('')}</tbody>`;
    inventoryContainer.appendChild(inventoryTable);
}

function updateTotalInventory() {
    let totalProducts = 0, totalValue = 0, totalExpired = 0, totalExpiringSoon = 0;
    sections.forEach(section => {
        inventory[section].forEach(item => {
            totalProducts++; totalValue += item.price * item.stock;
            if (isExpired(item.expiry_date)) totalExpired++;
            else if (isExpiringSoon(item.expiry_date)) totalExpiringSoon++;
        });
    });
    document.getElementById('total-products').textContent = totalProducts;
    document.getElementById('total-value').textContent = `₦${totalValue.toFixed(2)}`;
    document.getElementById('total-expired').textContent = totalExpired;
    document.getElementById('total-expiring-soon').textContent = totalExpiringSoon;
    loadTotalInventoryTable();
}

function loadTotalInventoryTable() {
    const inventoryContainer = document.querySelector('.js-total-inventory-container');
    inventoryContainer.innerHTML = '';
    const searchInput = document.getElementById('total-inventory-search');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let allItems = []; sections.forEach(section => { inventory[section].forEach(item => { allItems.push({ ...item, section }); }); });
    let filteredItems = allItems.filter(item => {
        const statusMatch = currentFilter === 'all' || getProductStatus(item) === currentFilter;
        const searchMatch = !searchTerm || item.name.toLowerCase().includes(searchTerm);
        return statusMatch && searchMatch;
    });
    if (filteredItems.length === 0) {
        inventoryContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-warehouse"></i></div><h3 class="empty-state-title">${searchTerm ? 'No Products Found' : 'No Products in Inventory'}</h3><p class="empty-state-description">${searchTerm ? 'Try a different search term.' : 'Start by adding products to your inventory.'}</p></div>`;
        return;
    }
    const inventoryTable = document.createElement('table'); inventoryTable.className = 'inventory-table';
    inventoryTable.innerHTML = `<thead><tr><th>Product</th><th>Department</th><th>Price</th><th>Stock</th><th>Expiry Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>${filteredItems.map(item => {
        const status = getProductStatus(item); let statusClass = '', statusText = '';
        if (status === 'in-stock') { statusClass = 'status-in-stock'; statusText = 'In Stock'; }
        else if (status === 'low-stock') { statusClass = 'status-low-stock'; statusText = 'Low Stock'; }
        else if (status === 'out-of-stock') { statusClass = 'status-out-of-stock'; statusText = 'Out of Stock'; }
        else if (status === 'expired') { statusClass = 'status-expired'; statusText = 'Expired'; }
        else if (status === 'expiring-soon') { statusClass = 'status-expiring-soon'; statusText = 'Expiring Soon'; }
        let sectionColor = ''; if (item.section === 'grill') sectionColor = 'var(--grill-color)'; else if (item.section === 'wholesale') sectionColor = 'var(--wholesale-color)'; else if (item.section === 'building') sectionColor = 'var(--building-color)'; else if (item.section === 'food') sectionColor = 'var(--food-color)';
        return `<tr data-item-id="${item.id}" data-section="${item.section}"><td>${item.name} ${item.isOffline ? '<i class="fas fa-wifi" style="color: #f39c12;" title="Pending sync"></i>' : ''}</td><td><span style="color: ${sectionColor}; font-weight: 600;">${sectionNames[item.section]}</span></td><td>₦${item.price.toFixed(2)}</td><td>${item.stock}</td><td>${formatDate(item.expiry_date)}</td><td><span class="status-badge ${statusClass}">${statusText}</span></td><td><button class="action-btn"><i class="fas fa-edit"></i></button><button class="action-btn delete"><i class="fas fa-trash"></i></button></td></tr>`;
    }).join('')}</tbody>`;
    inventoryContainer.appendChild(inventoryTable);
}

function filterTotalInventory(searchTerm) { loadTotalInventoryTable(); }

function resetPassword() {
    const email = document.getElementById('resetEmail').value;
    const errorElement = document.getElementById('reset-password-error');
    const successElement = document.getElementById('reset-password-success');
    supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }).then(({ data, error }) => {
        if (error) { errorElement.textContent = error.message; successElement.textContent = ''; }
        else { successElement.textContent = 'Password reset email sent. Check your inbox.'; errorElement.textContent = ''; }
    });
}

function showAddInventoryModal(section) {
    const modal = document.getElementById('addInventoryModal');
    document.getElementById('addInventoryForm').reset();
    modal.setAttribute('data-section', section);
    modal.classList.add('active');
}

function addNewInventory() {
    const modal = document.getElementById('addInventoryModal');
    const section = modal.getAttribute('data-section');
    const name = document.getElementById('addInventoryName').value;
    const price = parseFloat(document.getElementById('addInventoryPrice').value);
    const stock = parseInt(document.getElementById('addInventoryStock').value);
    const expiryDate = document.getElementById('addInventoryExpiry').value;
    const description = document.getElementById('addInventoryDescription').value;
    const newItem = { section, name, price, stock, expiry_date: expiryDate, description, created_by: currentUser ? currentUser.id : 'offline_user' };
    saveDataToSupabase('inventory', newItem).then(() => {
        modal.classList.remove('active');
        showNotification(`${name} added successfully!`, 'success');
    }).catch(error => { console.error('Error adding item:', error); });
}

function editInventoryItem(section, itemId) {
    const item = inventory[section].find(invItem => invItem.id === itemId);
    if (item) {
        document.getElementById('editInventoryName').value = item.name;
        document.getElementById('editInventoryPrice').value = item.price;
        document.getElementById('editInventoryStock').value = item.stock;
        document.getElementById('editInventoryExpiry').value = item.expiry_date || '';
        document.getElementById('editInventoryDescription').value = item.description || '';
        const editModal = document.getElementById('editInventoryModal');
        editModal.setAttribute('data-section', section);
        editModal.setAttribute('data-item-id', itemId);
        editModal.classList.add('active');
    }
}

function updateInventoryItem() {
    const editModal = document.getElementById('editInventoryModal');
    const section = editModal.getAttribute('data-section');
    const itemId = editModal.getAttribute('data-item-id');
    const name = document.getElementById('editInventoryName').value;
    const price = parseFloat(document.getElementById('editInventoryPrice').value);
    const stock = parseInt(document.getElementById('editInventoryStock').value);
    const expiryDate = document.getElementById('editInventoryExpiry').value;
    const description = document.getElementById('editInventoryDescription').value;
    const item = inventory[section].find(invItem => invItem.id === itemId);
    if (item) {
        const updatedItem = { ...item, name, price, stock, expiry_date: expiryDate, description, updated_by: currentUser ? currentUser.id : 'offline_user' };
        saveDataToSupabase('inventory', updatedItem, itemId).then(() => {
            editModal.classList.remove('active');
            showNotification(`${name} updated successfully!`, 'success');
        }).catch(error => { console.error('Error updating item:', error); });
    }
}

function deleteInventoryItem(section, itemId) {
    if (confirm('Are you sure you want to delete this item?')) {
        const item = inventory[section].find(invItem => invItem.id === itemId);
        if (item) {
            item.deleted = true; item.deleted_at = new Date().toISOString();
            saveDataToSupabase('inventory', item, itemId).then(() => {
                inventory[section] = inventory[section].filter(invItem => invItem.id !== itemId);
                saveToLocalStorage(`inventory_${section}`, inventory[section]);
                loadInventoryTable(section);
                updateDepartmentStats(section);
                updateCategoryInventorySummary(section);
                updateTotalInventory();
                showNotification('Item deleted successfully', 'success');
            }).catch(error => { console.error('Error deleting item:', error); });
        }
    }
}

function addToCart(section, item) {
    if (item.stock <= 0) { showNotification(`${item.name} is out of stock`, 'error'); return; }
    const existingItem = carts[section].find(cartItem => cartItem.id === item.id);
    if (existingItem) {
        if (existingItem.quantity >= item.stock) { showNotification(`Cannot add more ${item.name}. Only ${item.stock} in stock.`, 'warning'); return; }
        existingItem.quantity += 1;
    } else { carts[section].push({ id: item.id, name: item.name, price: item.price, quantity: 1 }); }
    saveToLocalStorage(`cart_${section}`, carts[section]);
    updateCart(section); showNotification(`${item.name} added to cart`, 'success');
}

function incrementQuantity(section, itemId) {
    const item = carts[section].find(cartItem => cartItem.id === itemId);
    const inventoryItem = inventory[section].find(invItem => invItem.id === itemId);
    if (item && inventoryItem && item.quantity < inventoryItem.stock) { item.quantity += 1; saveToLocalStorage(`cart_${section}`, carts[section]); updateCart(section); }
    else if (item && inventoryItem) { showNotification(`Cannot add more ${item.name}. Only ${inventoryItem.stock} in stock.`, 'warning'); }
}

function decrementQuantity(section, itemId) {
    const itemIndex = carts[section].findIndex(cartItem => cartItem.id === itemId);
    if (itemIndex !== -1) {
        if (carts[section][itemIndex].quantity > 1) carts[section][itemIndex].quantity -= 1;
        else carts[section].splice(itemIndex, 1);
        saveToLocalStorage(`cart_${section}`, carts[section]); updateCart(section);
    }
}

function removeFromCart(section, itemId) {
    carts[section] = carts[section].filter(cartItem => cartItem.id !== itemId);
    saveToLocalStorage(`cart_${section}`, carts[section]); updateCart(section);
}

function processCheckout(section) {
    if (carts[section].length === 0) { showNotification('Your cart is empty', 'error'); return; }
    const checkoutModal = document.getElementById('checkoutModal');
    const checkoutSummary = document.getElementById('checkout-summary'); let subtotal = 0; let summaryHTML = '<table class="inventory-table">';
    carts[section].forEach(item => { const itemTotal = item.price * item.quantity; subtotal += itemTotal; summaryHTML += `<tr><td>${item.name}</td><td>₦${item.price.toFixed(2)}</td><td>${item.quantity}</td><td>₦${itemTotal.toFixed(2)}</td></tr>`; });
    summaryHTML += `<tr><td colspan="3" class="total-label">Total</td><td>₦${subtotal.toFixed(2)}</td></tr></table>`;
    checkoutSummary.innerHTML = summaryHTML;
    checkoutModal.setAttribute('data-section', section);
    checkoutModal.classList.add('active');
}

// --- UPDATED FUNCTION: completeCheckout ---
function completeCheckout() {
    const checkoutModal = document.getElementById('checkoutModal');
    const section = checkoutModal.getAttribute('data-section');
    let subtotal = 0; 
    const saleItems = [];
    
    carts[section].forEach(item => {
        const itemTotal = item.price * item.quantity; 
        subtotal += itemTotal;
        saleItems.push({ id: item.id, name: item.name, price: item.price, quantity: item.quantity, total: itemTotal });
        const inventoryItem = inventory[section].find(invItem => invItem.id === item.id);
        if (inventoryItem) {
            inventoryItem.stock -= item.quantity;
            inventoryItem.status = getProductStatus(inventoryItem);
            saveToLocalStorage(`inventory_${section}`, inventory[section]);
            saveDataToSupabase('inventory', inventoryItem, inventoryItem.id).catch(error => console.error('Error updating inventory:', error));
        }
    });
    
    const saleRecord = {
        user_id: currentUser ? currentUser.id : 'offline_user', 
        user_email: currentUser ? currentUser.email : 'offline@example.com', 
        section, 
        items: saleItems, 
        subtotal, 
        total: subtotal,
        payment_method: document.getElementById('paymentMethod').value,
        customer_name: document.getElementById('customerName').value,
        customer_phone: document.getElementById('customerPhone').value
    };

    // --- FIX: Manually update ALL local state FIRST ---
    salesData[section].total_sales += subtotal; 
    salesData[section].total_transactions += 1;
    salesData[section].avg_transaction = salesData[section].total_sales / salesData[section].total_transactions;
    salesData[section].dailySales += subtotal; // <-- FIX: Update daily sales
    salesData[section].dailyTransactions += 1; // <-- FIX: Update daily transactions
    
    userData[section].transactions += 1; 
    userData[section].sales += subtotal;

    // Save the main sale record
    saveDataToSupabase('sales', saleRecord).then(() => {
        // Now save the aggregated summary data
        saveDataToSupabase('sales_data', salesData[section], section);
        saveDataToSupabase('user_data', userData[section], section);
        
        // --- FIX: Update UI ONCE at the end ---
        carts[section] = [];
        saveToLocalStorage(`cart_${section}`, []);
        updateCart(section); 
        loadInventoryTable(section); 
        updateReports(section);
        updateUserStats(section); 
        updateDepartmentStats(section); // This will now show the correct daily values
        updateCategoryInventorySummary(section);
        updateTotalInventory();
        
        checkoutModal.classList.remove('active');
        showNotification(`Sale completed successfully!`, 'success');
    }).catch(error => { 
        console.error('Error saving sale:', error); 
        showNotification('Error saving sale. Please try again.', 'error'); 
    });
}

function filterInventory(section, searchTerm) { loadInventoryTable(section); }

function updateReports(section) {
    const data = salesData[section];
    document.getElementById(`${section}-total-sales`).textContent = `₦${(data.total_sales || 0).toFixed(2)}`;
    document.getElementById(`${section}-total-transactions`).textContent = data.total_transactions || 0;
    document.getElementById(`${section}-avg-transaction`).textContent = `₦${(data.avg_transaction || 0).toFixed(2)}`;
    document.getElementById(`${section}-top-item`).textContent = data.top_item || '-';
}

function updateUserStats(section) {
    const data = userData[section];
    document.getElementById(`${section}-user-transactions`).textContent = data.transactions || 0;
    document.getElementById(`${section}-user-sales`).textContent = `₦${(data.sales || 0).toFixed(2)}`;
}

function updateDepartmentStats(section) {
    const lowStockItems = inventory[section].filter(item => getProductStatus(item) === 'low-stock').length;
    const dailySales = salesData[section]?.dailySales || 0;
    document.getElementById(`${section}-daily-sales`).textContent = `₦${dailySales.toFixed(2)}`;
    document.getElementById(`${section}-daily-transactions`).textContent = salesData[section]?.dailyTransactions || 0;
    document.getElementById(`${section}-low-stock`).textContent = lowStockItems;
}

function resetToPOSView(section) {
    document.querySelectorAll(`#${section}-section .sub-nav-item`).forEach(item => item.classList.remove('active'));
    document.querySelector(`#${section}-section .sub-nav-item[data-view="pos"]`).classList.add('active');
    document.querySelectorAll(`#${section}-section .view-content`).forEach(view => view.classList.remove('active'));
    document.getElementById(`${section}-pos-view`).classList.add('active');
    currentView = 'pos';
}

function saveAccountInfo(section) {
    // Placeholder function for saving account info
    const email = document.getElementById(`${section}-email`).value;
    console.log(`Saving account info for ${section}:`, { email });
    showNotification('Account information saved (locally).', 'success');
}

function closeModal(modalId) { document.getElementById(modalId).classList.remove('active'); }

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message; notification.className = `notification ${type}`;
    notification.classList.add('show');
    setTimeout(() => { notification.classList.remove('show'); }, 3000);
}

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').then(function(registration) {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, function(err) { console.log('ServiceWorker registration failed: ', err); });
  });
}