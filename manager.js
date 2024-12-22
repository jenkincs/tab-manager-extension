document.addEventListener('DOMContentLoaded', function() {
    loadSessions();
    
    // 返回按钮事件
    document.getElementById('back-to-popup').addEventListener('click', function() {
        window.close();
    });

    // 搜索功能
    document.getElementById('search-input').addEventListener('input', function(e) {
        const searchText = e.target.value.trim();
        filterSessions(searchText);
    });

    // 添加分页事件监听器
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadSessions();
        }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadSessions();
        }
    });

    // 导出功能
    document.getElementById('exportSessions').addEventListener('click', async () => {
        try {
            // 获取所有会话数据
            const sessions = await new Promise((resolve) => {
                chrome.storage.local.get(['savedSessions'], (result) => {
                    resolve(result.savedSessions || []);
                });
            });

            // 创建 Blob 对象
            const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
            
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tab-manager-sessions-${new Date().toISOString().split('T')[0]}.json`;
            
            // 触发下载
            document.body.appendChild(a);
            a.click();
            
            // 清理
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export sessions. Please try again.');
        }
    });

    // 导入功能
    document.getElementById('importSessions').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', async (event) => {
        try {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedSessions = JSON.parse(e.target.result);
                    
                    // 验证数据格式
                    if (!Array.isArray(importedSessions)) {
                        throw new Error('Invalid data format');
                    }

                    // 获取现有会话
                    const existingSessions = await new Promise((resolve) => {
                        chrome.storage.local.get(['savedSessions'], (result) => {
                            resolve(result.savedSessions || []);
                        });
                    });

                    // 合并会话，避免重复
                    const mergedSessions = [...existingSessions];
                    for (const importedSession of importedSessions) {
                        // 检查是否已存在相同名称的会话
                        const existingIndex = mergedSessions.findIndex(
                            session => session.name === importedSession.name
                        );

                        if (existingIndex === -1) {
                            // 如果不存在，直接添加
                            mergedSessions.push(importedSession);
                        } else {
                            // 如果存在，在名称后添加编号
                            let counter = 1;
                            let newName = `${importedSession.name} (${counter})`;
                            
                            // 循环直到找到一个不重复的名称
                            while (mergedSessions.some(session => session.name === newName)) {
                                counter++;
                                newName = `${importedSession.name} (${counter})`;
                            }
                            
                            importedSession.name = newName;
                            mergedSessions.push(importedSession);
                        }
                    }

                    // 保存合并后的会话
                    await new Promise((resolve, reject) => {
                        chrome.storage.local.set({ savedSessions: mergedSessions }, () => {
                            if (chrome.runtime.lastError) {
                                reject(chrome.runtime.lastError);
                            } else {
                                resolve();
                            }
                        });
                    });

                    // 刷新显示
                    await loadSessions();
                    alert(`Successfully imported ${importedSessions.length} sessions!`);
                } catch (error) {
                    console.error('Import failed:', error);
                    alert('Failed to import sessions. Please check the file format.');
                }
            };
            reader.readAsText(file);
        } catch (error) {
            console.error('Import failed:', error);
            alert('Failed to import sessions. Please try again.');
        }
        // 清理 input
        event.target.value = '';
    });
});

// 分页配置
const ITEMS_PER_PAGE = 5; // 每页显示的会话数
let currentPage = 1;
let totalPages = 1;
let currentSearchText = ''; // 保存当前搜索文本

// 加载会话
function loadSessions() {
    chrome.storage.local.get(['savedSessions'], function(result) {
        const sessions = result.savedSessions || [];
        displayFilteredSessions(sessions, currentSearchText);
    });
}

// 更新分页控件状态
function updatePagination(filteredLength) {
    totalPages = Math.ceil(filteredLength / ITEMS_PER_PAGE);
    // 如果当前页超过总页数，重置为第一页
    if (currentPage > totalPages) {
        currentPage = 1;
    }
    
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;
    
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;

    // 如果没有结果，隐藏分页
    const pagination = document.querySelector('.pagination');
    pagination.style.display = filteredLength === 0 ? 'none' : 'flex';
}

// 过滤和显示会话
function displayFilteredSessions(sessions, searchText) {
    const container = document.querySelector('.sessions-container');
    container.innerHTML = '';

    // 按创建时间从新到旧排序
    sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 过滤会话
    const filteredSessions = sessions.filter(session => {
        const sessionText = session.name.toLowerCase();
        const tabTitles = session.tabs.map(tab => tab.title.toLowerCase());
        const searchLower = searchText.toLowerCase();
        
        return sessionText.includes(searchLower) || 
               tabTitles.some(title => title.includes(searchLower));
    });

    if (filteredSessions.length === 0) {
        container.innerHTML = searchText 
            ? '<p style="text-align: center; color: #666;">No matching sessions found.</p>'
            : '<p style="text-align: center; color: #666;">No saved sessions found.</p>';
        updatePagination(0);
        return;
    }

    // 更新分页状态
    updatePagination(filteredSessions.length);
    
    // 计算当前页的起始和结束索引
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredSessions.length);
    const currentPageSessions = filteredSessions.slice(startIndex, endIndex);
    
    // 显示当前页的会话
    currentPageSessions.forEach((session, index) => {
        const actualIndex = sessions.indexOf(session); // 使用原始数组中的索引
        const sessionElement = document.createElement('div');
        sessionElement.className = 'session-item';
        
        // 格式化日期
        const date = new Date(session.date);
        const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        
        // 创建会话名称元素
        const sessionName = document.createElement('h3');
        sessionName.className = 'session-name';
        sessionName.textContent = session.name;
        sessionName.addEventListener('click', () => editSessionName(actualIndex));
        
        sessionElement.innerHTML = `
            <div class="session-header">
                <div class="session-info">
                    <div class="session-name-container"></div>
                    <div class="session-date">${formattedDate}</div>
                </div>
                <div class="session-actions">
                    <button class="btn-primary">Restore</button>
                    <button class="btn-danger">Delete Session</button>
                </div>
            </div>
            <div class="tab-list">
                ${session.tabs.map((tab, tabIndex) => `
                    <div class="tab-item" style="cursor: pointer;">
                        <img class="tab-favicon" src="${tab.favIconUrl || 'icons/icon16.png'}" onerror="this.src='icons/icon16.png'">
                        <span class="tab-title" title="${tab.title}">${tab.title}</span>
                        <button class="delete-tab" title="Delete tab">&times;</button>
                    </div>
                `).join('')}
            </div>
        `;

        // 插入会话名称
        const nameContainer = sessionElement.querySelector('.session-name-container');
        nameContainer.appendChild(sessionName);

        // 添加按钮事件监听器
        const restoreBtn = sessionElement.querySelector('.btn-primary');
        const deleteSessionBtn = sessionElement.querySelector('.btn-danger');
        const deleteTabBtns = sessionElement.querySelectorAll('.delete-tab');
        const tabItems = sessionElement.querySelectorAll('.tab-item');

        restoreBtn.addEventListener('click', () => restoreSession(actualIndex));
        deleteSessionBtn.addEventListener('click', () => deleteSession(actualIndex));
        
        // 为每个标签项添加点击事件
        tabItems.forEach((tabItem, tabIndex) => {
            tabItem.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-tab')) {
                    e.stopPropagation();
                    deleteTab(actualIndex, tabIndex);
                    return;
                }
                openTabInCurrentWindow(session.tabs[tabIndex].url);
            });
        });

        // 为删除按钮添加事件监听器
        deleteTabBtns.forEach((btn, tabIndex) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteTab(actualIndex, tabIndex);
            });
        });

        container.appendChild(sessionElement);
    });
}

// 搜索功能
function filterSessions(searchText) {
    currentSearchText = searchText; // 保存搜索文本
    currentPage = 1; // 重置到第一页
    loadSessions();
}

// 在当前窗口打开标签页
function openTabInCurrentWindow(url) {
    chrome.windows.getCurrent(function(currentWindow) {
        chrome.tabs.query({ windowId: currentWindow.id }, function(tabs) {
            chrome.tabs.create({
                url: url,
                active: false,
                index: tabs.length  // 在最右侧打开
            });
        });
    });
}

// 编辑会话名称
function editSessionName(sessionIndex) {
    const sessionNameElement = document.querySelectorAll('.session-name')[sessionIndex];
    const currentName = sessionNameElement.textContent;
    
    // 如果已经在编辑状态，不要重复创建输入框
    if (sessionNameElement.querySelector('input')) {
        return;
    }
    
    // 创建输入框
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'session-name-input';
    input.style.width = Math.max(100, sessionNameElement.offsetWidth) + 'px';
    
    // 替换标题为输入框
    sessionNameElement.textContent = '';
    sessionNameElement.appendChild(input);
    input.focus();
    
    // 选中所有文本
    input.select();
    
    // 处理输入完成
    function handleComplete() {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            // 更新存储
            chrome.storage.local.get(['savedSessions'], function(result) {
                const sessions = result.savedSessions || [];
                if (sessions[sessionIndex]) {
                    sessions[sessionIndex].name = newName;
                    chrome.storage.local.set({ savedSessions: sessions }, function() {
                        // 更新显示
                        sessionNameElement.textContent = newName;
                    });
                }
            });
        } else {
            // 恢复原名称
            sessionNameElement.textContent = currentName;
        }
    }
    
    // 添加事件监听器
    input.addEventListener('blur', handleComplete);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleComplete();
            input.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            sessionNameElement.textContent = currentName;
            input.blur();
        }
    });
}

// 删除单个标签
function deleteTab(sessionIndex, tabIndex) {
    chrome.storage.local.get(['savedSessions'], function(result) {
        const sessions = result.savedSessions || [];
        
        // 删除指定的标签
        sessions[sessionIndex].tabs.splice(tabIndex, 1);
        
        // 如果session中没有标签了，删除整个session
        if (sessions[sessionIndex].tabs.length === 0) {
            sessions.splice(sessionIndex, 1);
        }
        
        // 保存更新后的sessions
        chrome.storage.local.set({ savedSessions: sessions }, function() {
            loadSessions(); // 重新加载显示
        });
    });
}

// 删除整个会话
function deleteSession(sessionIndex) {
    if (confirm('Are you sure you want to delete this session?')) {
        chrome.storage.local.get(['savedSessions'], function(result) {
            const sessions = result.savedSessions || [];
            
            // 删除指定的session
            sessions.splice(sessionIndex, 1);
            
            // 保存更新后的sessions
            chrome.storage.local.set({ savedSessions: sessions }, function() {
                loadSessions(); // 重新加载显示
            });
        });
    }
}

// 恢复会话
function restoreSession(sessionIndex) {
    chrome.storage.local.get(['savedSessions'], function(result) {
        const sessions = result.savedSessions || [];
        const session = sessions[sessionIndex];
        
        if (!session || !session.tabs || session.tabs.length === 0) {
            console.error('No tabs to restore');
            return;
        }

        // 获取当前窗口
        chrome.windows.getCurrent(function(currentWindow) {
            // 获取当前窗口中的所有标签页
            chrome.tabs.query({ windowId: currentWindow.id }, function(tabs) {
                // 创建所有标签页
                session.tabs.forEach((tab, index) => {
                    chrome.tabs.create({
                        url: tab.url,
                        active: index === 0, // 只激活第一个标签页
                        index: tabs.length + index // 在现有标签页之后添加
                    });
                });
            });
        });
    });
}

// 暴露函数到全局作用域
window.deleteTab = deleteTab;
window.deleteSession = deleteSession;
window.restoreSession = restoreSession;
window.editSessionName = editSessionName;
window.backToTabManager = function() {
    window.close();
};
