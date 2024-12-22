document.addEventListener('DOMContentLoaded', function() {
    loadSessions();
    
    // 返回按钮事件
    document.getElementById('back-to-popup').addEventListener('click', function() {
        window.close();
    });

    // 搜索功能
    document.getElementById('search-input').addEventListener('input', function(e) {
        const searchText = e.target.value.toLowerCase().trim();
        filterSessions(searchText);
    });
});

// 加载会话列表
function loadSessions() {
    chrome.storage.local.get(['savedSessions'], function(result) {
        const sessions = result.savedSessions || [];
        
        // 调试日志
        console.log('All sessions:', sessions);
        sessions.forEach((session, index) => {
            console.log(`Session ${index}:`, {
                name: session.name,
                date: session.date,
                tabCount: session.tabs.length,
                tabs: session.tabs
            });
        });
        
        // 按创建时间从新到旧排序
        sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        displaySessions(sessions);
    });
}

// 过滤会话列表
function filterSessions(searchText) {
    chrome.storage.local.get(['savedSessions'], function(result) {
        const sessions = result.savedSessions || [];
        
        // 按创建时间从新到旧排序
        sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (!searchText) {
            displaySessions(sessions);
            return;
        }

        // 过滤会话
        const filteredSessions = sessions.filter(session => {
            // 搜索会话名称
            if (session.name.toLowerCase().includes(searchText)) {
                return true;
            }
            // 搜索标签页标题
            return session.tabs.some(tab => 
                tab.title.toLowerCase().includes(searchText)
            );
        });

        displaySessions(filteredSessions);
    });
}

// 显示会话列表
function displaySessions(sessions) {
    const container = document.querySelector('.sessions-container');
    container.innerHTML = '';
    
    if (sessions.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No saved sessions found.</p>';
        return;
    }
    
    sessions.forEach((session, sessionIndex) => {
        const sessionElement = document.createElement('div');
        sessionElement.className = 'session-item';
        
        // 格式化日期
        const date = new Date(session.date);
        const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        
        // 创建会话名称元素
        const sessionName = document.createElement('h3');
        sessionName.className = 'session-name';
        sessionName.textContent = session.name;
        sessionName.addEventListener('click', () => editSessionName(sessionIndex));
        
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

        restoreBtn.addEventListener('click', () => restoreSession(sessionIndex));
        deleteSessionBtn.addEventListener('click', () => deleteSession(sessionIndex));
        
        // 为每个标签项添加点击事件
        tabItems.forEach((tabItem, tabIndex) => {
            tabItem.addEventListener('click', (e) => {
                // 如果点击的是删除按钮，不打开标签页
                if (e.target.classList.contains('delete-tab')) {
                    e.stopPropagation();
                    deleteTab(sessionIndex, tabIndex);
                    return;
                }
                // 在当前窗口最右侧打开标签页
                openTabInCurrentWindow(session.tabs[tabIndex].url);
            });
        });

        // 为删除按钮添加事件监听器
        deleteTabBtns.forEach((btn, tabIndex) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteTab(sessionIndex, tabIndex);
            });
        });

        container.appendChild(sessionElement);
    });
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
