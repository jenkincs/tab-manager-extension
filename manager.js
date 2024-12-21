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
        
        sessionElement.innerHTML = `
            <div class="session-header">
                <div class="session-info">
                    <h3 class="session-name">${session.name}</h3>
                    <div class="session-date">${formattedDate}</div>
                </div>
                <div class="session-actions">
                    <button class="btn-primary" onclick="restoreSession(${sessionIndex})">Restore</button>
                    <button class="btn-danger" onclick="deleteSession(${sessionIndex})">Delete Session</button>
                </div>
            </div>
            <div class="tab-list">
                ${session.tabs.map((tab, tabIndex) => `
                    <div class="tab-item">
                        <img class="tab-favicon" src="${tab.favIconUrl || 'icons/icon16.png'}" onerror="this.src='icons/icon16.png'">
                        <span class="tab-title" title="${tab.title}">${tab.title}</span>
                        <button class="delete-tab" onclick="deleteTab(${sessionIndex}, ${tabIndex})" title="Delete tab">&times;</button>
                    </div>
                `).join('')}
            </div>
        `;
        
        // 添加事件监听器
        const restoreBtn = sessionElement.querySelector('.btn-primary');
        const deleteSessionBtn = sessionElement.querySelector('.btn-danger');
        const deleteTabBtns = sessionElement.querySelectorAll('.delete-tab');

        restoreBtn.addEventListener('click', () => restoreSession(sessionIndex));
        deleteSessionBtn.addEventListener('click', () => deleteSession(sessionIndex));
        deleteTabBtns.forEach((btn, tabIndex) => {
            btn.addEventListener('click', () => deleteTab(sessionIndex, tabIndex));
        });

        container.appendChild(sessionElement);
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
        
        // 创建一个新的窗口来恢复所有标签
        chrome.windows.create({ focused: true }, function(newWindow) {
            // 恢复所有标签
            session.tabs.forEach((tab, index) => {
                // 第一个标签更新现有标签，其他的创建新标签
                if (index === 0) {
                    chrome.tabs.update(newWindow.tabs[0].id, { url: tab.url });
                } else {
                    chrome.tabs.create({
                        windowId: newWindow.id,
                        url: tab.url,
                        active: false
                    });
                }
            });
        });
    });
}

// 暴露函数到全局作用域
window.deleteTab = deleteTab;
window.deleteSession = deleteSession;
window.restoreSession = restoreSession;
window.backToTabManager = function() {
    window.close();
};
