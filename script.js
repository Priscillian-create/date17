// Initialize Supabase with your configuration
const supabaseUrl = 'https://qgayglybnnrhobcvftrs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYXQiOjE3NjI2ODQ5ODMsImV4cCI6MjA3ODI2MDk4M30.dqiEe-v1cro5N4tuawu7Y1x5klSyjINsLHd9-V40QjQ';
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
    'grill': { total_sales: 0, total_transactions: 0, avg_transaction: 0, top_item: '-', dailySales: 0, dailyTransactions: 0, salesHistory: [] },
    'wholesale': { total_sales: 0, total_transactions: 0, avg_transaction: 0, top_item: '-', dailySales: 0, dailyTransactions: 0, salesHistory: [] },
    'building': { total_sales: 0, total_transactions: 0, avg_transaction: 0, top_item: '-', dailySales: 0, dailyTransactions: 0, salesHistory: [] },
    'food': { total_sales: 0, total_transactions: 0, avg_transaction: 0, top_item: '-', dailySales: 0, dailyTransactions: 0, salesHistory: [] }
};

// Initialize user data with proper default values
const userData = {
    'grill': { transactions: 0, sales: 0 },
    'wholesale': { transactions: 0, sales: 0 },
    'building': { transactions: 0, sales: 0 },
    'food': { transactions: 0, sales: 0 }
};

// Initialize expenses data for each section
const expensesData = {
    'grill': [],
    'wholesale': [],
    'building': [],
    'food': []
};

// Initialize purchases data for each section
const purchasesData = {
    'grill': [],
    'wholesale': [],
    'building': [],
    'food': []
};

// Initialize sales records for each section
const salesRecords = {
    'grill': [],
    'wholesale': [],
    'building': [],
    'food': []
};

// Current section and view
let currentSection = 'grill';
let currentView = 'pos';
let currentFilter = 'all';
let currentUser = null;

// Chart instances
const salesCharts = {};
const profitLossCharts = {};

// Load data from localStorage immediately on script load
function loadDataFromLocalStorage() {
    sections.forEach(section => {
        inventory[section] = loadFromLocalStorage(`inventory_${section}`, []);
        salesData[section] = loadFromLocalStorage(`salesData_${section}`, salesData[section]);
        userData[section] = loadFromLocalStorage(`userData_${section}`, userData[section]);
        carts[section] = loadFromLocalStorage(`cart_${section}`, []);
        expensesData[section] = loadFromLocalStorage(`expenses_${section}`, []);
        purchasesData[section] = loadFromLocalStorage(`purchases_${section}`, []);
        salesRecords[section] = loadFromLocalStorage(`salesRecords_${section}`, []);
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
    return diffTime > 0 && diffDays <= 7;
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

// Format date and time for display
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
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

// Save data to Supabase with offline support
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
        // Special handling for deleted items
        if (data.deleted === true) {
            // Remove from local inventory immediately
            const index = inventory[data.section].findIndex(item => item.id === id);
            if (index !== -1) {
                inventory[data.section].splice(index, 1);
                saveToLocalStorage(`inventory_${data.section}`, inventory[data.section]);
                loadInventoryTable(data.section);
                updateDepartmentStats(data.section);
                updateCategoryInventorySummary(data.section);
                updateTotalInventory();
            }
        } else if (!id) {
            // New item
            id = generateOfflineId();
            localData.id = id;
            localData.isOffline = true;
            inventory[data.section].push(localData);
        } else {
            // Update existing item
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
    // Handle expenses
    else if (table === 'expenses') {
        if (!id) {
            id = generateOfflineId();
            localData.id = id;
            localData.isOffline = true;
            expensesData[data.section].unshift(localData); // Add to beginning
        }
        saveToLocalStorage(`expenses_${data.section}`, expensesData[data.section]);
        loadExpensesTable(data.section);
        updateDepartmentStats(data.section);
    }
    // Handle purchases
    else if (table === 'purchases') {
        if (!id) {
            id = generateOfflineId();
            localData.id = id;
            localData.isOffline = true;
            purchasesData[data.section].unshift(localData); // Add to beginning
        }
        saveToLocalStorage(`purchases_${data.section}`, purchasesData[data.section]);
        loadPurchasesTable(data.section);
        updateDepartmentStats(data.section);
    }
    // Handle sales records
    else if (table === 'sales_records') {
        if (!id) {
            id = generateOfflineId();
            localData.id = id;
            localData.isOffline = true;
            salesRecords[data.section].unshift(localData); // Add to beginning
        }
        saveToLocalStorage(`salesRecords_${data.section}`, salesRecords[data.section]);
        loadSalesRecordsTable(data.section);
    }
    // Add optimistic updates for summary tables
    else if (table === 'sales_data') {
        const section = id; // For sales_data, 'id' is the section name
        if (section && salesData[section]) {
            salesData[section] = { ...salesData[section], ...data };
            saveToLocalStorage(`salesData_${section}`, salesData[section]);
            updateReports(section);
            updateDepartmentStats(section);
            updateSalesChart(section);
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
        const pendingSales = loadFromLocalStorage('pending_sales', []);
        pendingSales.push(localData);
        saveToLocalStorage('pending_sales', pendingSales);
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
                // Handle deletion
                if (dataForSupabase.deleted === true) {
                    const { error } = await supabase.from(table).delete().eq('id', id);
                    if (error) throw error;
                    result = { id, deleted: true };
                } else {
                    const { data: resultData, error } = await supabase.from(table).update(dataForSupabase).eq('id', id).select();
                    if (error) throw error;
                    result = resultData[0];
                }
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

// Sync all pending offline data when coming back online
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
        
        // 2. Sync pending expenses
        sections.forEach(section => {
            const offlineExpenses = expensesData[section].filter(item => item.isOffline);
            offlineExpenses.forEach(async (expense) => {
                try {
                    const { isOffline, timestamp, userId, ...dataForSupabase } = expense;
                    delete dataForSupabase.id;
                    
                    const { data: resultData, error } = await supabase.from('expenses').insert(dataForSupabase).select();
                    if (error) throw error;
                    
                    if (resultData && resultData[0]) {
                        // Remove the offline expense from local data
                        const index = expensesData[section].findIndex(e => e.id === expense.id);
                        if (index !== -1) {
                            expensesData[section].splice(index, 1);
                            syncCount++;
                        }
                    }
                } catch (error) {
                    console.error('Error syncing expense:', error);
                }
            });
            
            // Save the updated expenses
            saveToLocalStorage(`expenses_${section}`, expensesData[section]);
            loadExpensesTable(section);
        });
        
        // 3. Sync pending purchases
        sections.forEach(section => {
            const offlinePurchases = purchasesData[section].filter(item => item.isOffline);
            offlinePurchases.forEach(async (purchase) => {
                try {
                    const { isOffline, timestamp, userId, ...dataForSupabase } = purchase;
                    delete dataForSupabase.id;
                    
                    const { data: resultData, error } = await supabase.from('purchases').insert(dataForSupabase).select();
                    if (error) throw error;
                    
                    if (resultData && resultData[0]) {
                        // Remove the offline purchase from local data
                        const index = purchasesData[section].findIndex(p => p.id === purchase.id);
                        if (index !== -1) {
                            purchasesData[section].splice(index, 1);
                            syncCount++;
                        }
                    }
                } catch (error) {
                    console.error('Error syncing purchase:', error);
                }
            });
            
            // Save the updated purchases
            saveToLocalStorage(`purchases_${section}`, purchasesData[section]);
            loadPurchasesTable(section);
        });
        
        // 4. Sync pending sales records
        sections.forEach(section => {
            const offlineSalesRecords = salesRecords[section].filter(item => item.isOffline);
            offlineSalesRecords.forEach(async (record) => {
                try {
                    const { isOffline, timestamp, userId, ...dataForSupabase } = record;
                    delete dataForSupabase.id;
                    
                    const { data: resultData, error } = await supabase.from('sales_records').insert(dataForSupabase).select();
                    if (error) throw error;
                    
                    if (resultData && resultData[0]) {
                        // Remove the offline record from local data
                        const index = salesRecords[section].findIndex(r => r.id === record.id);
                        if (index !== -1) {
                            salesRecords[section].splice(index, 1);
                            syncCount++;
                        }
                    }
                } catch (error) {
                    console.error('Error syncing sales record:', error);
                }
            });
            
            // Save the updated sales records
            saveToLocalStorage(`salesRecords_${section}`, salesRecords[section]);
            loadSalesRecordsTable(section);
        });
        
        // 5. Sync pending deletions
        const pendingDeletions = loadFromLocalStorage('pending_deletions', []);
        for (const deletion of pendingDeletions) {
            try {
                const { id, section } = deletion;
                const { error } = await supabase.from('inventory').delete().eq('id', id);
                if (error) throw error;
                syncCount++;
            } catch (error) {
                console.error('Error syncing deletion:', error);
            }
        }
        
        // Clear pending deletions after syncing
        if (pendingDeletions.length > 0) {
            saveToLocalStorage('pending_deletions', []);
        }
        
        // 6. Sync pending sales
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
        
        // 7. Sync sales_data and user_data for each section
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
                
                syncCount++;
            } catch (error) {
                console.error(`Error syncing ${section} sales data:`, error);
            }
            
            try {
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
                console.error(`Error syncing ${section} user data:`, error);
            }
        }
        
        // Update all UI components after syncing
        sections.forEach(section => {
            updateReports(section);
            updateUserStats(section);
            updateDepartmentStats(section);
            updateSalesChart(section);
            updateProfitLossChart(section);
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
        // Initialize app with local data first
        initializeApp();
        // Then load from server
        loadDataFromSupabase();
        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOfflineStatus);
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});

// Update user info in UI
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
        
        // Use Promise.all to load all data in parallel for better performance
        const inventoryPromises = sections.map(section => 
            supabase.from('inventory').select('*').eq('section', section).is('deleted', 'false')
        );
        
        const salesDataPromises = sections.map(section => 
            supabase.from('sales_data').select('*').eq('id', section).single()
        );
        
        const userDataPromises = sections.map(section => 
            supabase.from('user_data').select('*').eq('id', section).single()
        );
        
        // Load expenses, purchases, and sales records
        const expensesPromises = sections.map(section => 
            supabase.from('expenses').select('*').eq('section', section).order('created_at', { ascending: false })
        );
        
        const purchasesPromises = sections.map(section => 
            supabase.from('purchases').select('*').eq('section', section).order('created_at', { ascending: false })
        );
        
        const salesRecordsPromises = sections.map(section => 
            supabase.from('sales_records').select('*').eq('section', section).order('created_at', { ascending: false })
        );
        
        // Wait for all promises to resolve
        const [inventoryResults, salesDataResults, userDataResults, expensesResults, purchasesResults, salesRecordsResults] = await Promise.allSettled([
            Promise.all(inventoryPromises),
            Promise.all(salesDataPromises),
            Promise.all(userDataPromises),
            Promise.all(expensesPromises),
            Promise.all(purchasesPromises),
            Promise.all(salesRecordsPromises)
        ]);
        
        // Process inventory results
        if (inventoryResults.status === 'fulfilled') {
            inventoryResults.value.forEach(({ data, error }, index) => {
                const section = sections[index];
                if (error) {
                    console.error(`Error loading ${section} inventory:`, error);
                    return;
                }
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
        }
        
        // Process sales data results
        if (salesDataResults.status === 'fulfilled') {
            salesDataResults.value.forEach(({ data, error }, index) => {
                const section = sections[index];
                if (!error && data) {
                    // Merge with local data, preserving any local changes
                    salesData[section] = { ...data, ...salesData[section] };
                    saveToLocalStorage(`salesData_${section}`, salesData[section]);
                    updateReports(section);
                    updateSalesChart(section);
                }
            });
        }
        
        // Process user data results
        if (userDataResults.status === 'fulfilled') {
            userDataResults.value.forEach(({ data, error }, index) => {
                const section = sections[index];
                if (!error && data) {
                    // Merge with local data, preserving any local changes
                    userData[section] = { ...data, ...userData[section] };
                    saveToLocalStorage(`userData_${section}`, userData[section]);
                    updateUserStats(section);
                }
            });
        }
        
        // Process expenses results
        if (expensesResults.status === 'fulfilled') {
            expensesResults.value.forEach(({ data, error }, index) => {
                const section = sections[index];
                if (!error && data) {
                    // Merge server data with local offline data
                    const localOfflineExpenses = expensesData[section].filter(e => e.isOffline);
                    expensesData[section] = [...data, ...localOfflineExpenses];
                    saveToLocalStorage(`expenses_${section}`, expensesData[section]);
                    loadExpensesTable(section);
                }
            });
        }
        
        // Process purchases results
        if (purchasesResults.status === 'fulfilled') {
            purchasesResults.value.forEach(({ data, error }, index) => {
                const section = sections[index];
                if (!error && data) {
                    // Merge server data with local offline data
                    const localOfflinePurchases = purchasesData[section].filter(p => p.isOffline);
                    purchasesData[section] = [...data, ...localOfflinePurchases];
                    saveToLocalStorage(`purchases_${section}`, purchasesData[section]);
                    loadPurchasesTable(section);
                }
            });
        }
        
        // Process sales records results
        if (salesRecordsResults.status === 'fulfilled') {
            salesRecordsResults.value.forEach(({ data, error }, index) => {
                const section = sections[index];
                if (!error && data) {
                    // Merge server data with local offline data
                    const localOfflineRecords = salesRecords[section].filter(r => r.isOffline);
                    salesRecords[section] = [...data, ...localOfflineRecords];
                    saveToLocalStorage(`salesRecords_${section}`, salesRecords[section]);
                    loadSalesRecordsTable(section);
                }
            });
        }
        
        // Update total inventory once after all sections are loaded
        updateTotalInventory();
        
    } catch (error) { 
        console.error('Error loading data from Supabase:', error); 
    }
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', function() {
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            currentUser = session.user;
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            updateUserInfo(session.user);
            // Initialize app with local data first
            initializeApp();
            // Then load from server
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
            if (error) { 
                errorElement.textContent = error.message; 
                document.getElementById('emailLoginBtn').disabled = false; 
                document.getElementById('emailLoginBtn').textContent = 'Sign In'; 
            }
        });
    });

    document.getElementById('logoutBtn').addEventListener('click', () => supabase.auth.signOut());
    document.getElementById('forgotPasswordLink').addEventListener('click', (e) => { 
        e.preventDefault(); 
        document.getElementById('forgotPasswordModal').classList.add('active'); 
    });

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
                button.classList.add('active'); 
                currentFilter = filter; 
                loadTotalInventoryTable(); 
                return;
            }
            document.querySelectorAll(`[data-section="${section}"].filter-btn`).forEach(btn => btn.classList.remove('active'));
            button.classList.add('active'); 
            currentFilter = filter; 
            loadInventoryTable(section);
        });
    });

    document.querySelector('.js-add-inventory-confirm-btn').addEventListener('click', addNewInventory);
    document.querySelector('.js-update-inventory-btn').addEventListener('click', updateInventoryItem);
    document.querySelector('.js-complete-checkout-btn').addEventListener('click', completeCheckout);
    document.querySelector('.js-reset-password-btn').addEventListener('click', resetPassword);

    // Event listeners for expenses, purchases, and sales records
    document.querySelector('.js-add-expense-btn').addEventListener('click', () => showAddExpenseModal(currentSection));
    document.querySelector('.js-add-purchase-btn').addEventListener('click', () => showAddPurchaseModal(currentSection));
    document.querySelector('.js-add-expense-confirm-btn').addEventListener('click', addExpense);
    document.querySelector('.js-add-purchase-confirm-btn').addEventListener('click', addPurchase);

    setupEventDelegation();
});

function setupEventDelegation() {
    document.querySelector('.nav-tabs').addEventListener('click', (e) => {
        const tab = e.target.closest('.nav-tab'); 
        if (!tab) return;
        const section = tab.getAttribute('data-section');
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active')); 
        tab.classList.add('active');
        document.querySelectorAll('.section-container').forEach(s => s.classList.remove('active'));
        if (section === 'total-inventory') {
            document.getElementById('total-inventory-section').classList.add('active'); 
            currentSection = 'total-inventory'; 
            updateTotalInventory();
        } else {
            document.getElementById(`${section}-section`).classList.add('active'); 
            currentSection = section; 
            resetToPOSView(section);
        }
    });

    document.querySelectorAll('.sub-nav').forEach(nav => {
        nav.addEventListener('click', (e) => {
            const item = e.target.closest('.sub-nav-item'); 
            if (!item) return;
            const view = item.getAttribute('data-view');
            const section = nav.closest('.section-container').id.replace('-section', '');
            document.querySelectorAll(`#${section}-section .sub-nav-item`).forEach(i => i.classList.remove('active')); 
            item.classList.add('active');
            document.querySelectorAll(`#${section}-section .view-content`).forEach(v => v.classList.remove('active'));
            document.getElementById(`${section}-${view}-view`).classList.add('active');
            currentView = view;
            if (view === 'inventory') { 
                loadInventoryTable(section); 
                updateCategoryInventorySummary(section); 
            }
            else if (view === 'reports') { 
                updateReports(section); 
                updateSalesChart(section); 
            }
            else if (view === 'account') {
                updateUserStats(section); 
            }
            // Handle new views
            else if (view === 'financial') { 
                loadExpensesTable(section); 
                loadPurchasesTable(section); 
                updateProfitLossChart(section);
            }
            else if (view === 'sales-history') { 
                loadSalesRecordsTable(section); 
            }
        });
    });

    // Financial tabs
    document.querySelectorAll('.financial-tabs').forEach(tabs => {
        tabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.financial-tab'); 
            if (!tab) return;
            const tabName = tab.getAttribute('data-tab');
            const section = tabs.closest('.section-container').id.replace('-section', '');
            
            document.querySelectorAll(`#${section}-financial-view .financial-tab`).forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll(`#${section}-financial-view .financial-tab-content`).forEach(c => c.classList.remove('active'));
            document.getElementById(`${section}-${tabName}-tab`).classList.add('active');
            
            if (tabName === 'profit-loss') {
                updateProfitLossChart(section);
            }
        });
    });

    document.querySelectorAll('.js-pos-search-results').forEach(container => {
        container.addEventListener('click', (e) => {
            const resultItem = e.target.closest('.pos-search-result-item'); 
            if (!resultItem) return;
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
            const btn = e.target.closest('.action-btn'); 
            if (!btn) return;
            const row = btn.closest('tr');
            const itemId = row.getAttribute('data-item-id');
            if (btn.classList.contains('delete')) deleteInventoryItem(section, itemId);
            else editInventoryItem(section, itemId);
        });
    });
    
    document.querySelector('.js-total-inventory-container').addEventListener('click', (e) => {
        const btn = e.target.closest('.action-btn'); 
        if (!btn) return;
        const row = btn.closest('tr');
        const itemId = row.getAttribute('data-item-id');
        const section = row.getAttribute('data-section');
        if (btn.classList.contains('delete')) deleteInventoryItem(section, itemId);
        else editInventoryItem(section, itemId);
    });

    // Event delegation for expenses table
    document.querySelectorAll('.js-expenses-container').forEach(container => {
        container.addEventListener('click', (e) => {
            const section = container.getAttribute('data-section');
            const btn = e.target.closest('.action-btn'); 
            if (!btn) return;
            const row = btn.closest('tr');
            const itemId = row.getAttribute('data-item-id');
            if (btn.classList.contains('delete')) deleteExpense(section, itemId);
        });
    });

    // Event delegation for purchases table
    document.querySelectorAll('.js-purchases-container').forEach(container => {
        container.addEventListener('click', (e) => {
            const section = container.getAttribute('data-section');
            const btn = e.target.closest('.action-btn'); 
            if (!btn) return;
            const row = btn.closest('tr');
            const itemId = row.getAttribute('data-item-id');
            if (btn.classList.contains('delete')) deletePurchase(section, itemId);
        });
    });

    // Event delegation for sales records table
    document.querySelectorAll('.js-sales-records-container').forEach(container => {
        container.addEventListener('click', (e) => {
            const section = container.getAttribute('data-section');
            const btn = e.target.closest('.action-btn'); 
            if (!btn) return;
            const row = btn.closest('tr');
            const itemId = row.getAttribute('data-item-id');
            if (btn.classList.contains('delete')) deleteSalesRecord(section, itemId);
            else if (btn.classList.contains('view')) viewSalesRecord(section, itemId);
        });
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
        // Initialize new views
        loadExpensesTable(section);
        loadPurchasesTable(section);
        loadSalesRecordsTable(section);
        updateSalesChart(section);
        updateProfitLossChart(section);
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
    cartItemsContainer.innerHTML = ''; 
    let subtotal = 0;
    if (carts[section].length === 0) {
        cartItemsContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-shopping-cart"></i></div><h3 class="empty-state-title">Your Cart is Empty</h3><p class="empty-state-description">Search for products to add to your cart.</p></div>`;
        document.querySelector(`.js-checkout-btn[data-section="${section}"]`).disabled = true;
    } else {
        carts[section].forEach(item => {
            const itemTotal = item.price * item.quantity; 
            subtotal += itemTotal;
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item'; 
            cartItem.setAttribute('data-item-id', item.id);
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
    const inventoryTable = document.createElement('table'); 
    inventoryTable.className = 'inventory-table';
    inventoryTable.innerHTML = `<thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Expiry Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>${filteredItems.map(item => {
        const status = getProductStatus(item); 
        let statusClass = '', statusText = '';
        if (status === 'in-stock') { statusClass = 'status-in-stock'; statusText = 'In Stock'; }
        else if (status === 'low-stock') { statusClass = 'status-low-stock'; statusText = 'Low Stock'; }
        else if (status === 'out-of-stock') { statusClass = 'status-out-of-stock'; statusText = 'Out of Stock'; }
        else if (status === 'expired') { statusClass = 'status-expired'; statusText = 'Expired'; }
        else if (status === 'expiring-soon') { statusClass = 'status-expiring-soon'; statusText = 'Expiring Soon'; }
        return `<tr data-item-id="${item.id}"><td>${item.name} ${item.isOffline ? '<i class="fas fa-wifi" style="color: #f39c12;" title="Pending sync"></i>' : ''}</td><td>₦${item.price.toFixed(2)}</td><td>${item.stock}</td><td>${formatDate(item.expiry_date)}</td><td><span class="status-badge ${statusClass}">${statusText}</span></td><td><button class="action-btn"><i class="fas fa-edit"></i></button><button class="action-btn delete"><i class="fas fa-trash"></i></button></td></tr>`;
    }).join('')}</tbody>`;
    inventoryContainer.appendChild(inventoryTable);
}

// Load expenses table
function loadExpensesTable(section) {
    const expensesContainer = document.querySelector(`.js-expenses-container[data-section="${section}"]`);
    if (!expensesContainer) return;
    
    expensesContainer.innerHTML = '';
    if (expensesData[section].length === 0) {
        expensesContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-receipt"></i></div><h3 class="empty-state-title">No Expenses Recorded</h3><p class="empty-state-description">Start tracking your expenses by adding your first expense record.</p><button class="btn btn-primary js-add-expense-btn" data-section="${section}"><i class="fas fa-plus"></i> Add First Expense</button></div>`;
        return;
    }
    
    const expensesTable = document.createElement('table');
    expensesTable.className = 'inventory-table';
    expensesTable.innerHTML = `<thead><tr><th>Description</th><th>Category</th><th>Amount</th><th>Date</th><th>Actions</th></tr></thead><tbody>${expensesData[section].map(expense => {
        return `<tr data-item-id="${expense.id}"><td>${expense.description} ${expense.isOffline ? '<i class="fas fa-wifi" style="color: #f39c12;" title="Pending sync"></i>' : ''}</td><td>${expense.category || 'General'}</td><td>₦${expense.amount.toFixed(2)}</td><td>${formatDate(expense.date)}</td><td><button class="action-btn delete"><i class="fas fa-trash"></i></button></td></tr>`;
    }).join('')}</tbody>`;
    expensesContainer.appendChild(expensesTable);
}

// Load purchases table
function loadPurchasesTable(section) {
    const purchasesContainer = document.querySelector(`.js-purchases-container[data-section="${section}"]`);
    if (!purchasesContainer) return;
    
    purchasesContainer.innerHTML = '';
    if (purchasesData[section].length === 0) {
        purchasesContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-shopping-basket"></i></div><h3 class="empty-state-title">No Purchases Recorded</h3><p class="empty-state-description">Start tracking your purchases by adding your first purchase record.</p><button class="btn btn-primary js-add-purchase-btn" data-section="${section}"><i class="fas fa-plus"></i> Add First Purchase</button></div>`;
        return;
    }
    
    const purchasesTable = document.createElement('table');
    purchasesTable.className = 'inventory-table';
    purchasesTable.innerHTML = `<thead><tr><th>Description</th><th>Supplier</th><th>Amount</th><th>Date</th><th>Actions</th></tr></thead><tbody>${purchasesData[section].map(purchase => {
        return `<tr data-item-id="${purchase.id}"><td>${purchase.description} ${purchase.isOffline ? '<i class="fas fa-wifi" style="color: #f39c12;" title="Pending sync"></i>' : ''}</td><td>${purchase.supplier || 'N/A'}</td><td>₦${purchase.amount.toFixed(2)}</td><td>${formatDate(purchase.date)}</td><td><button class="action-btn delete"><i class="fas fa-trash"></i></button></td></tr>`;
    }).join('')}</tbody>`;
    purchasesContainer.appendChild(purchasesTable);
}

// Load sales records table
function loadSalesRecordsTable(section) {
    const salesRecordsContainer = document.querySelector(`.js-sales-records-container[data-section="${section}"]`);
    if (!salesRecordsContainer) return;
    
    salesRecordsContainer.innerHTML = '';
    if (salesRecords[section].length === 0) {
        salesRecordsContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-cash-register"></i></div><h3 class="empty-state-title">No Sales Records</h3><p class="empty-state-description">Sales records will appear here once you start making sales.</p></div>`;
        return;
    }
    
    const salesRecordsTable = document.createElement('table');
    salesRecordsTable.className = 'inventory-table';
    salesRecordsTable.innerHTML = `<thead><tr><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Actions</th></tr></thead><tbody>${salesRecords[section].map(record => {
        const itemsCount = record.items ? record.items.length : 0;
        return `<tr data-item-id="${record.id}"><td>${formatDateTime(record.created_at)} ${record.isOffline ? '<i class="fas fa-wifi" style="color: #f39c12;" title="Pending sync"></i>' : ''}</td><td>${record.customer_name || 'Walk-in'}</td><td>${itemsCount} items</td><td>₦${record.total.toFixed(2)}</td><td>${record.payment_method || 'Cash'}</td><td><button class="action-btn view"><i class="fas fa-eye"></i></button><button class="action-btn delete"><i class="fas fa-trash"></i></button></td></tr>`;
    }).join('')}</tbody>`;
    salesRecordsContainer.appendChild(salesRecordsTable);
}

function updateTotalInventory() {
    let totalProducts = 0, totalValue = 0, totalExpired = 0, totalExpiringSoon = 0;
    sections.forEach(section => {
        inventory[section].forEach(item => {
            totalProducts++; 
            totalValue += item.price * item.stock;
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
    let allItems = []; 
    sections.forEach(section => { 
        inventory[section].forEach(item => { 
            allItems.push({ ...item, section }); 
        }); 
    });
    let filteredItems = allItems.filter(item => {
        const statusMatch = currentFilter === 'all' || getProductStatus(item) === currentFilter;
        const searchMatch = !searchTerm || item.name.toLowerCase().includes(searchTerm);
        return statusMatch && searchMatch;
    });
    if (filteredItems.length === 0) {
        inventoryContainer.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-warehouse"></i></div><h3 class="empty-state-title">${searchTerm ? 'No Products Found' : 'No Products in Inventory'}</h3><p class="empty-state-description">${searchTerm ? 'Try a different search term.' : 'Start by adding products to your inventory.'}</p></div>`;
        return;
    }
    const inventoryTable = document.createElement('table'); 
    inventoryTable.className = 'inventory-table';
    inventoryTable.innerHTML = `<thead><tr><th>Product</th><th>Department</th><th>Price</th><th>Stock</th><th>Expiry Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>${filteredItems.map(item => {
        const status = getProductStatus(item); 
        let statusClass = '', statusText = '';
        if (status === 'in-stock') { statusClass = 'status-in-stock'; statusText = 'In Stock'; }
        else if (status === 'low-stock') { statusClass = 'status-low-stock'; statusText = 'Low Stock'; }
        else if (status === 'out-of-stock') { statusClass = 'status-out-of-stock'; statusText = 'Out of Stock'; }
        else if (status === 'expired') { statusClass = 'status-expired'; statusText = 'Expired'; }
        else if (status === 'expiring-soon') { statusClass = 'status-expiring-soon'; statusText = 'Expiring Soon'; }
        let sectionColor = ''; 
        if (item.section === 'grill') sectionColor = 'var(--grill-color)'; 
        else if (item.section === 'wholesale') sectionColor = 'var(--wholesale-color)'; 
        else if (item.section === 'building') sectionColor = 'var(--building-color)'; 
        else if (item.section === 'food') sectionColor = 'var(--food-color)';
        return `<tr data-item-id="${item.id}" data-section="${item.section}"><td>${item.name} ${item.isOffline ? '<i class="fas fa-wifi" style="color: #f39c12;" title="Pending sync"></i>' : ''}</td><td><span style="color: ${sectionColor}; font-weight: 600;">${sectionNames[item.section]}</span></td><td>₦${item.price.toFixed(2)}</td><td>${item.stock}</td><td>${formatDate(item.expiry_date)}</td><td><span class="status-badge ${statusClass}">${statusText}</span></td><td><button class="action-btn"><i class="fas fa-edit"></i></button><button class="action-btn delete"><i class="fas fa-trash"></i></button></td></tr>`;
    }).join('')}</tbody>`;
    inventoryContainer.appendChild(inventoryTable);
}

function filterTotalInventory(searchTerm) { 
    loadTotalInventoryTable(); 
}

function resetPassword() {
    const email = document.getElementById('resetEmail').value;
    const errorElement = document.getElementById('reset-password-error');
    const successElement = document.getElementById('reset-password-success');
    supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }).then(({ data, error }) => {
        if (error) { 
            errorElement.textContent = error.message; 
            successElement.textContent = ''; 
        }
        else { 
            successElement.textContent = 'Password reset email sent. Check your inbox.'; 
            errorElement.textContent = ''; 
        }
    });
}

function showAddInventoryModal(section) {
    const modal = document.getElementById('addInventoryModal');
    document.getElementById('addInventoryForm').reset();
    modal.setAttribute('data-section', section);
    modal.classList.add('active');
}

// Show add expense modal
function showAddExpenseModal(section) {
    const modal = document.getElementById('addExpenseModal');
    document.getElementById('addExpenseForm').reset();
    // Set today's date as default
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    modal.setAttribute('data-section', section);
    modal.classList.add('active');
}

// Show add purchase modal
function showAddPurchaseModal(section) {
    const modal = document.getElementById('addPurchaseModal');
    document.getElementById('addPurchaseForm').reset();
    // Set today's date as default
    document.getElementById('purchaseDate').value = new Date().toISOString().split('T')[0];
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
    }).catch(error => { 
        console.error('Error adding item:', error); 
    });
}

// Add expense
function addExpense() {
    const modal = document.getElementById('addExpenseModal');
    const section = modal.getAttribute('data-section');
    const description = document.getElementById('expenseDescription').value;
    const category = document.getElementById('expenseCategory').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const date = document.getElementById('expenseDate').value;
    const newExpense = { section, description, category, amount, date, created_by: currentUser ? currentUser.id : 'offline_user' };
    saveDataToSupabase('expenses', newExpense).then(() => {
        modal.classList.remove('active');
        showNotification('Expense added successfully!', 'success');
    }).catch(error => { 
        console.error('Error adding expense:', error); 
    });
}

// Add purchase
function addPurchase() {
    const modal = document.getElementById('addPurchaseModal');
    const section = modal.getAttribute('data-section');
    const description = document.getElementById('purchaseDescription').value;
    const supplier = document.getElementById('purchaseSupplier').value;
    const amount = parseFloat(document.getElementById('purchaseAmount').value);
    const date = document.getElementById('purchaseDate').value;
    const newPurchase = { section, description, supplier, amount, date, created_by: currentUser ? currentUser.id : 'offline_user' };
    saveDataToSupabase('purchases', newPurchase).then(() => {
        modal.classList.remove('active');
        showNotification('Purchase added successfully!', 'success');
    }).catch(error => { 
        console.error('Error adding purchase:', error); 
    });
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
        }).catch(error => { 
            console.error('Error updating item:', error); 
        });
    }
}

// Delete expense
function deleteExpense(section, expenseId) {
    if (confirm('Are you sure you want to delete this expense?')) {
        if (navigator.onLine && !expenseId.startsWith('offline_')) {
            supabase.from('expenses').delete().eq('id', expenseId).then(({ error }) => {
                if (error) {
                    console.error('Error deleting expense:', error);
                    showNotification('Error deleting expense', 'error');
                } else {
                    showNotification('Expense deleted successfully', 'success');
                }
            });
        }
        
        // Remove from local data immediately
        expensesData[section] = expensesData[section].filter(expense => expense.id !== expenseId);
        saveToLocalStorage(`expenses_${section}`, expensesData[section]);
        loadExpensesTable(section);
        updateDepartmentStats(section);
    }
}

// Delete purchase
function deletePurchase(section, purchaseId) {
    if (confirm('Are you sure you want to delete this purchase?')) {
        if (navigator.onLine && !purchaseId.startsWith('offline_')) {
            supabase.from('purchases').delete().eq('id', purchaseId).then(({ error }) => {
                if (error) {
                    console.error('Error deleting purchase:', error);
                    showNotification('Error deleting purchase', 'error');
                } else {
                    showNotification('Purchase deleted successfully', 'success');
                }
            });
        }
        
        // Remove from local data immediately
        purchasesData[section] = purchasesData[section].filter(purchase => purchase.id !== purchaseId);
        saveToLocalStorage(`purchases_${section}`, purchasesData[section]);
        loadPurchasesTable(section);
        updateDepartmentStats(section);
    }
}

// Delete sales record
function deleteSalesRecord(section, recordId) {
    if (confirm('Are you sure you want to delete this sales record? This will reverse the sale and restore inventory.')) {
        const record = salesRecords[section].find(r => r.id === recordId);
        if (record) {
            // Restore inventory items
            if (record.items) {
                record.items.forEach(item => {
                    const inventoryItem = inventory[section].find(inv => inv.id === item.id);
                    if (inventoryItem) {
                        inventoryItem.stock += item.quantity;
                        saveDataToSupabase('inventory', inventoryItem, inventoryItem.id);
                    }
                });
            }
            
            // Update sales data
            salesData[section].total_sales -= record.total;
            salesData[section].total_transactions -= 1;
            if (salesData[section].total_transactions > 0) {
                salesData[section].avg_transaction = salesData[section].total_sales / salesData[section].total_transactions;
            } else {
                salesData[section].avg_transaction = 0;
            }
            saveDataToSupabase('sales_data', salesData[section], section);
            
            // Delete from database
            if (navigator.onLine && !recordId.startsWith('offline_')) {
                supabase.from('sales_records').delete().eq('id', recordId).then(({ error }) => {
                    if (error) {
                        console.error('Error deleting sales record:', error);
                        showNotification('Error deleting sales record', 'error');
                    } else {
                        showNotification('Sales record deleted and inventory restored', 'success');
                    }
                });
            }
            
            // Remove from local data
            salesRecords[section] = salesRecords[section].filter(record => record.id !== recordId);
            saveToLocalStorage(`salesRecords_${section}`, salesRecords[section]);
            loadSalesRecordsTable(section);
            updateReports(section);
            updateDepartmentStats(section);
        }
    }
}

// View sales record details
function viewSalesRecord(section, recordId) {
    const record = salesRecords[section].find(r => r.id === recordId);
    if (record) {
        const modal = document.getElementById('viewSalesRecordModal');
        const detailsContainer = document.getElementById('salesRecordDetails');
        
        let itemsHTML = '';
        if (record.items) {
            itemsHTML = '<table class="inventory-table"><thead><tr><th>Item</th><th>Price</th><th>Quantity</th><th>Total</th></tr></thead><tbody>';
            record.items.forEach(item => {
                itemsHTML += `<tr><td>${item.name}</td><td>₦${item.price.toFixed(2)}</td><td>${item.quantity}</td><td>₦${item.total.toFixed(2)}</td></tr>`;
            });
            itemsHTML += '</tbody></table>';
        }
        
        detailsContainer.innerHTML = `
            <div class="sales-record-info">
                <p><strong>Date:</strong> ${formatDateTime(record.created_at)}</p>
                <p><strong>Customer:</strong> ${record.customer_name || 'Walk-in'}</p>
                <p><strong>Phone:</strong> ${record.customer_phone || 'N/A'}</p>
                <p><strong>Payment Method:</strong> ${record.payment_method || 'Cash'}</p>
                <p><strong>Total Amount:</strong> ₦${record.total.toFixed(2)}</p>
            </div>
            <div class="sales-record-items">
                <h3>Items Purchased</h3>
                ${itemsHTML}
            </div>
        `;
        
        modal.classList.add('active');
    }
}

// Delete inventory item
function deleteInventoryItem(section, itemId) {
    if (confirm('Are you sure you want to delete this item?')) {
        const item = inventory[section].find(invItem => invItem.id === itemId);
        if (item) {
            // If online, try to delete from server immediately
            if (navigator.onLine && !itemId.startsWith('offline_')) {
                supabase.from('inventory').delete().eq('id', itemId).then(({ error }) => {
                    if (error) {
                        console.error('Error deleting item from server:', error);
                        showNotification('Error deleting item from server. Will try again when online.', 'error');
                        // Add to pending deletions for later sync
                        const pendingDeletions = loadFromLocalStorage('pending_deletions', []);
                        pendingDeletions.push({ id: itemId, section });
                        saveToLocalStorage('pending_deletions', pendingDeletions);
                    } else {
                        showNotification('Item deleted successfully', 'success');
                    }
                });
            } else if (itemId.startsWith('offline_')) {
                // For offline items, just track the deletion
                const pendingDeletions = loadFromLocalStorage('pending_deletions', []);
                pendingDeletions.push({ id: itemId, section });
                saveToLocalStorage('pending_deletions', pendingDeletions);
            }
            
            // Remove from local inventory immediately
            inventory[section] = inventory[section].filter(invItem => invItem.id !== itemId);
            saveToLocalStorage(`inventory_${section}`, inventory[section]);
            loadInventoryTable(section);
            updateDepartmentStats(section);
            updateCategoryInventorySummary(section);
            updateTotalInventory();
        }
    }
}

function addToCart(section, item) {
    if (item.stock <= 0) { 
        showNotification(`${item.name} is out of stock`, 'error'); 
        return; 
    }
    const existingItem = carts[section].find(cartItem => cartItem.id === item.id);
    if (existingItem) {
        if (existingItem.quantity >= item.stock) { 
            showNotification(`Cannot add more ${item.name}. Only ${item.stock} in stock.`, 'warning'); 
            return; 
        }
        existingItem.quantity += 1;
    } else { 
        carts[section].push({ id: item.id, name: item.name, price: item.price, quantity: 1 }); 
    }
    saveToLocalStorage(`cart_${section}`, carts[section]);
    updateCart(section); 
    showNotification(`${item.name} added to cart`, 'success');
}

function incrementQuantity(section, itemId) {
    const item = carts[section].find(cartItem => cartItem.id === itemId);
    const inventoryItem = inventory[section].find(invItem => invItem.id === itemId);
    if (item && inventoryItem && item.quantity < inventoryItem.stock) { 
        item.quantity += 1; 
        saveToLocalStorage(`cart_${section}`, carts[section]); 
        updateCart(section); 
    }
    else if (item && inventoryItem) { 
        showNotification(`Cannot add more ${item.name}. Only ${inventoryItem.stock} in stock.`, 'warning'); 
    }
}

function decrementQuantity(section, itemId) {
    const itemIndex = carts[section].findIndex(cartItem => cartItem.id === itemId);
    if (itemIndex !== -1) {
        if (carts[section][itemIndex].quantity > 1) carts[section][itemIndex].quantity -= 1;
        else carts[section].splice(itemIndex, 1);
        saveToLocalStorage(`cart_${section}`, carts[section]); 
        updateCart(section);
    }
}

function removeFromCart(section, itemId) {
    carts[section] = carts[section].filter(cartItem => cartItem.id !== itemId);
    saveToLocalStorage(`cart_${section}`, carts[section]); 
    updateCart(section);
}

function processCheckout(section) {
    if (carts[section].length === 0) { 
        showNotification('Your cart is empty', 'error'); 
        return; 
    }
    const checkoutModal = document.getElementById('checkoutModal');
    const checkoutSummary = document.getElementById('checkout-summary'); 
    let subtotal = 0; 
    let summaryHTML = '<table class="inventory-table">';
    carts[section].forEach(item => { 
        const itemTotal = item.price * item.quantity; 
        subtotal += itemTotal; 
        summaryHTML += `<tr><td>${item.name}</td><td>₦${item.price.toFixed(2)}</td><td>${item.quantity}</td><td>₦${itemTotal.toFixed(2)}</td></tr>`; 
    });
    summaryHTML += `<tr><td colspan="3" class="total-label">Total</td><td>₦${subtotal.toFixed(2)}</td></tr></table>`;
    checkoutSummary.innerHTML = summaryHTML;
    checkoutModal.setAttribute('data-section', section);
    checkoutModal.classList.add('active');
}

// Complete checkout
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
        section,
        items: saleItems, 
        total: subtotal,
        payment_method: document.getElementById('paymentMethod').value,
        customer_name: document.getElementById('customerName').value,
        customer_phone: document.getElementById('customerPhone').value,
        created_at: new Date().toISOString()
    };

    // Manually update ALL local state FIRST
    salesData[section].total_sales += subtotal; 
    salesData[section].total_transactions += 1;
    salesData[section].avg_transaction = salesData[section].total_sales / salesData[section].total_transactions;
    salesData[section].dailySales += subtotal;
    salesData[section].dailyTransactions += 1;
    
    userData[section].transactions += 1; 
    userData[section].sales += subtotal;

    // Save the main sale record
    saveDataToSupabase('sales_records', saleRecord).then(() => {
        // Save to legacy sales table for compatibility
        const legacySaleRecord = {
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
        saveDataToSupabase('sales', legacySaleRecord);
        
        // Now save the aggregated summary data
        saveDataToSupabase('sales_data', salesData[section], section);
        saveDataToSupabase('user_data', userData[section], section);
        
        // Update UI ONCE at the end
        carts[section] = [];
        saveToLocalStorage(`cart_${section}`, carts[section]);
        updateCart(section); 
        loadInventoryTable(section); 
        updateReports(section);
        updateUserStats(section); 
        updateDepartmentStats(section);
        updateCategoryInventorySummary(section);
        updateTotalInventory();
        updateSalesChart(section);
        updateProfitLossChart(section);
        
        checkoutModal.classList.remove('active');
        showNotification(`Sale completed successfully!`, 'success');
    }).catch(error => { 
        console.error('Error saving sale:', error); 
        showNotification('Error saving sale. Please try again.', 'error'); 
    });
}

function filterInventory(section, searchTerm) { 
    loadInventoryTable(section); 
}

function updateReports(section) {
    const data = salesData[section];
    document.getElementById(`${section}-total-sales`).textContent = `₦${(data.total_sales || 0).toFixed(2)}`;
    document.getElementById(`${section}-total-transactions`).textContent = data.total_transactions || 0;
    document.getElementById(`${section}-avg-transaction`).textContent = `₦${(data.avg_transaction || 0).toFixed(2)}`;
    document.getElementById(`${section}-top-item`).textContent = data.top_item || '-';
    
    // Update sales analysis metrics
    updateSalesAnalysis(section);
}

function updateSalesAnalysis(section) {
    // Calculate daily average sales
    const totalDays = Math.max(1, salesRecords[section].length);
    const dailyAvgSales = salesData[section].total_sales / totalDays;
    document.getElementById(`${section}-daily-avg-sales`).textContent = `₦${dailyAvgSales.toFixed(2)}`;
    
    // Find peak sales day
    const salesByDay = {};
    salesRecords[section].forEach(record => {
        const day = new Date(record.created_at).toLocaleDateString();
        if (!salesByDay[day]) salesByDay[day] = 0;
        salesByDay[day] += record.total;
    });
    
    let peakDay = '-';
    let peakSales = 0;
    for (const [day, sales] of Object.entries(salesByDay)) {
        if (sales > peakSales) {
            peakSales = sales;
            peakDay = day;
        }
    }
    document.getElementById(`${section}-peak-sales-day`).textContent = peakDay;
    
    // Calculate sales growth rate
    const recentSales = salesRecords[section].slice(0, 7).reduce((sum, record) => sum + record.total, 0);
    const previousSales = salesRecords[section].slice(7, 14).reduce((sum, record) => sum + record.total, 0);
    const growthRate = previousSales > 0 ? ((recentSales - previousSales) / previousSales * 100) : 0;
    document.getElementById(`${section}-sales-growth`).textContent = `${growthRate.toFixed(1)}%`;
    
    // Find most profitable item
    const itemProfits = {};
    salesRecords[section].forEach(record => {
        if (record.items) {
            record.items.forEach(item => {
                if (!itemProfits[item.name]) itemProfits[item.name] = 0;
                itemProfits[item.name] += item.total;
            });
        }
    });
    
    let profitableItem = '-';
    let maxProfit = 0;
    for (const [item, profit] of Object.entries(itemProfits)) {
        if (profit > maxProfit) {
            maxProfit = profit;
            profitableItem = item;
        }
    }
    document.getElementById(`${section}-profitable-item`).textContent = profitableItem;
}

function updateUserStats(section) {
    const data = userData[section];
    document.getElementById(`${section}-user-transactions`).textContent = data.transactions || 0;
    document.getElementById(`${section}-user-sales`).textContent = `₦${(data.sales || 0).toFixed(2)}`;
}

function updateDepartmentStats(section) {
    const lowStockItems = inventory[section].filter(item => getProductStatus(item) === 'low-stock').length;
    const dailySales = salesData[section]?.dailySales || 0;
    
    // Calculate total expenses and purchases
    const totalExpenses = expensesData[section].reduce((sum, expense) => sum + expense.amount, 0);
    const totalPurchases = purchasesData[section].reduce((sum, purchase) => sum + purchase.amount, 0);
    
    document.getElementById(`${section}-daily-sales`).textContent = `₦${dailySales.toFixed(2)}`;
    document.getElementById(`${section}-daily-transactions`).textContent = salesData[section]?.dailyTransactions || 0;
    document.getElementById(`${section}-low-stock`).textContent = lowStockItems;
    
    // Update expenses and purchases display
    const expensesElement = document.getElementById(`${section}-total-expenses`);
    const purchasesElement = document.getElementById(`${section}-total-purchases`);
    const netProfitElement = document.getElementById(`${section}-net-profit`);
    
    if (expensesElement) expensesElement.textContent = `₦${totalExpenses.toFixed(2)}`;
    if (purchasesElement) purchasesElement.textContent = `₦${totalPurchases.toFixed(2)}`;
    if (netProfitElement) netProfitElement.textContent = `₦${(dailySales - totalExpenses).toFixed(2)}`;
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

function closeModal(modalId) { 
    document.getElementById(modalId).classList.remove('active'); 
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message; 
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    setTimeout(() => { 
        notification.classList.remove('show'); 
    }, 3000);
}

// Update sales chart
function updateSalesChart(section) {
    const ctx = document.getElementById(`${section}-sales-chart`);
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (salesCharts[section]) {
        salesCharts[section].destroy();
    }
    
    // Prepare data for the last 7 days
    const last7Days = [];
    const chartSalesData = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString();
        last7Days.push(dateStr);
        
        // Calculate sales for this day
        const daySales = salesRecords[section]
            .filter(record => new Date(record.created_at).toLocaleDateString() === dateStr)
            .reduce((sum, record) => sum + record.total, 0);
        chartSalesData.push(daySales);
    }
    
    salesCharts[section] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: [{
                label: 'Daily Sales',
                data: chartSalesData,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-color') + '20',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₦' + value.toFixed(0);
                        }
                    }
                }
            }
        }
    });
}

// Update profit and loss chart
function updateProfitLossChart(section) {
    const ctx = document.getElementById(`${section}-profit-loss-chart`);
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (profitLossCharts[section]) {
        profitLossCharts[section].destroy();
    }
    
    // Calculate totals
    const totalRevenue = salesData[section].total_sales || 0;
    const totalExpenses = expensesData[section].reduce((sum, expense) => sum + expense.amount, 0);
    const totalPurchases = purchasesData[section].reduce((sum, purchase) => sum + purchase.amount, 0);
    const netProfit = totalRevenue - totalExpenses - totalPurchases;
    
    // Update summary values
    document.getElementById(`${section}-total-revenue`).textContent = `₦${totalRevenue.toFixed(2)}`;
    document.getElementById(`${section}-total-expenses-pl`).textContent = `₦${totalExpenses.toFixed(2)}`;
    document.getElementById(`${section}-total-purchases-pl`).textContent = `₦${totalPurchases.toFixed(2)}`;
    document.getElementById(`${section}-net-profit-pl`).textContent = `₦${netProfit.toFixed(2)}`;
    
    profitLossCharts[section] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Revenue', 'Expenses', 'Purchases'],
            datasets: [{
                data: [totalRevenue, totalExpenses, totalPurchases],
                backgroundColor: [
                    getComputedStyle(document.documentElement).getPropertyValue('--success-color'),
                    getComputedStyle(document.documentElement).getPropertyValue('--danger-color'),
                    getComputedStyle(document.documentElement).getPropertyValue('--warning-color')
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').then(function(registration) {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, function(err) { 
        console.log('ServiceWorker registration failed: ', err); 
        // Fix for manifest icon error
        if (err.message.includes('icon-144x144.png')) {
            console.log('Ignoring manifest icon error - this is expected in development');
        }
    });
  });
}