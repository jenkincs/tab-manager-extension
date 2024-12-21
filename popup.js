document.addEventListener('DOMContentLoaded', function() {
  // Prevent any click events from closing the popup
  document.body.addEventListener('click', function(e) {
    // Only stop propagation if the click is directly on the body
    if (e.target === document.body) {
      e.stopPropagation();
    }
  }, true);

  // Add close popup functionality
  document.getElementById('close-popup').addEventListener('click', function(e) {
    e.preventDefault();
    window.close();
  });

  // Keep popup focused
  window.addEventListener('blur', function(e) {
    // If blur event is from closing a tab, prevent it
    if (e.target === window) {
      setTimeout(() => window.focus(), 0);
    }
  });

  let currentTabs = [];

  // Initialize from storage
  chrome.storage.local.get(['savedSessions'], function(result) {
    if (result.savedSessions) {
      displaySavedSessions(result.savedSessions);
    }
  });

  // Function to safely remove a tab without closing the popup
  function safeRemoveTab(tabId, callback) {
    try {
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
        }
        if (typeof callback === 'function') {
          setTimeout(callback, 50);
        }
      });
    } catch (error) {
      console.error('Error removing tab:', error);
    }
  }

  // Search functionality
  const searchInput = document.getElementById('search-tabs');
  searchInput.addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    filterTabs(searchTerm);
  });

  function filterTabs(searchTerm) {
    const tabItems = document.querySelectorAll('.tab-item');
    tabItems.forEach(item => {
      const title = item.querySelector('.tab-title').textContent.toLowerCase();
      const url = item.title.toLowerCase();
      if (title.includes(searchTerm) || url.includes(searchTerm)) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  }

  // Session management
  document.getElementById('save-session').addEventListener('click', function(e) {
    e.preventDefault();
    const sessionName = prompt('Enter session name:');
    if (sessionName && sessionName.trim()) {
      saveCurrentSession(sessionName.trim());
    }
  });

  function saveCurrentSession(sessionName) {
    chrome.tabs.query({ currentWindow: true }, function(tabs) {
      chrome.storage.local.get(['savedSessions'], function(result) {
        const savedSessions = result.savedSessions || [];
        
        // 确保保存完整的tab信息，包括favIconUrl
        const sessionTabs = tabs.map(tab => ({
          title: tab.title,
          url: tab.url,
          favIconUrl: tab.favIconUrl || `chrome://favicon/${tab.url}`
        }));

        const session = {
          name: sessionName,
          date: new Date().toISOString(),
          tabs: sessionTabs
        };

        savedSessions.unshift(session);
        
        chrome.storage.local.set({ 
          savedSessions: savedSessions 
        }, function() {
          displaySavedSessions(savedSessions);
        });
      });
    });
  }

  // 搜索会话功能
  document.getElementById('search-sessions').addEventListener('input', function(e) {
    const searchText = e.target.value.toLowerCase();
    filterSessions(searchText);
  });

  function filterSessions(searchText) {
    chrome.storage.local.get(['savedSessions'], function(result) {
      const sessions = result.savedSessions || [];
      
      // 先按时间排序
      sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      let filteredSessions;
      if (searchText) {
        filteredSessions = sessions.filter(session => {
          // 搜索session名称
          if (session.name.toLowerCase().includes(searchText)) {
            return true;
          }
          // 搜索session中的tab标题
          return session.tabs.some(tab => 
            tab.title.toLowerCase().includes(searchText)
          );
        });
      } else {
        filteredSessions = sessions;
      }

      displaySavedSessions(filteredSessions);
    });
  }

  // 修改显示保存的会话函数
  function displaySavedSessions(sessions) {
    const container = document.getElementById('saved-sessions');
    container.innerHTML = '';
    
    sessions.forEach(session => {
      const sessionDiv = document.createElement('div');
      sessionDiv.className = 'session-item';
      
      const sessionInfo = document.createElement('div');
      sessionInfo.className = 'session-info';
      
      const sessionName = document.createElement('span');
      sessionName.className = 'session-name';
      sessionName.textContent = session.name;
      
      const tabsCount = document.createElement('span');
      tabsCount.className = 'session-tabs-count';
      tabsCount.textContent = `(${session.tabs.length} tabs)`;
      
      sessionInfo.appendChild(sessionName);
      sessionInfo.appendChild(tabsCount);
      
      const buttonsDiv = document.createElement('div');
      buttonsDiv.className = 'session-buttons';
      
      const loadButton = document.createElement('button');
      loadButton.className = 'load';
      loadButton.textContent = 'Load';
      loadButton.onclick = () => loadSession(session);
      
      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete';
      deleteButton.textContent = 'Delete';
      deleteButton.onclick = () => deleteSession(session);
      
      buttonsDiv.appendChild(loadButton);
      buttonsDiv.appendChild(deleteButton);
      
      sessionDiv.appendChild(sessionInfo);
      sessionDiv.appendChild(buttonsDiv);
      container.appendChild(sessionDiv);
    });
  }

  function loadSession(session) {
    if (confirm('Load this session? Current tabs will be closed.')) {
      // First create a new tab to prevent the window from closing
      chrome.tabs.create({ url: session.tabs[0].url }, function(firstTab) {
        // Then remove all other tabs
        chrome.tabs.query({}, function(tabs) {
          const tabsToRemove = tabs
            .filter(tab => tab.id !== firstTab.id)
            .map(tab => tab.id);
          
          tabsToRemove.forEach(tabId => {
            safeRemoveTab(tabId);
          });
          
          // Finally, create the rest of the tabs from the session
          session.tabs.slice(1).forEach(tab => {
            chrome.tabs.create({ url: tab.url });
          });
        });
      });
    }
  }

  function deleteSession(sessionToDelete) {
    if (confirm('Delete this session?')) {
      chrome.storage.local.get(['savedSessions'], function(result) {
        const sessions = result.savedSessions.filter(session => 
          session.name !== sessionToDelete.name || session.date !== sessionToDelete.date
        );
        chrome.storage.local.set({ savedSessions: sessions }, function() {
          displaySavedSessions(sessions);
        });
      });
    }
  }

  // 管理按钮点击事件
  document.getElementById('open-manager').addEventListener('click', function() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('manager.html')
    });
    window.close();
  });

  // Get all tabs
  function listTabs() {
    chrome.tabs.query({}, function(tabs) {
      currentTabs = tabs;
      const tabList = document.getElementById('tab-list');
      tabList.innerHTML = '';
      
      tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);

      tabs.forEach(tab => {
        const tabItem = document.createElement('div');
        tabItem.className = 'tab-item';
        tabItem.title = tab.url;
        
        const favicon = document.createElement('img');
        favicon.src = tab.favIconUrl || 'icons/icon16.png';
        favicon.className = 'favicon';
        favicon.alt = 'Favicon';

        const title = document.createElement('span');
        title.textContent = tab.title;
        title.className = 'tab-title';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.className = 'close-tab';
        closeBtn.title = 'Close Tab';
        
        // Create a wrapper for the close button to handle events
        const closeBtnWrapper = document.createElement('div');
        closeBtnWrapper.className = 'close-btn-wrapper';
        closeBtnWrapper.appendChild(closeBtn);
        
        // Handle close button click
        closeBtnWrapper.addEventListener('mousedown', function(e) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }, true);
        
        closeBtnWrapper.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          const popupWindow = chrome.extension.getViews({type: 'popup'})[0];
          safeRemoveTab(tab.id, () => {
            if (popupWindow) {
              listTabs();
            }
          });
          
          return false;
        }, true);

        tabItem.appendChild(favicon);
        tabItem.appendChild(title);
        tabItem.appendChild(closeBtnWrapper);

        // Make tab item clickable to switch to that tab
        tabItem.addEventListener('click', (e) => {
          if (!e.target.classList.contains('close-tab') && 
              !e.target.classList.contains('close-btn-wrapper')) {
            e.preventDefault();
            e.stopPropagation();
            chrome.tabs.update(tab.id, { active: true });
          }
        });

        tabList.appendChild(tabItem);
      });
    });
  }

  // Close all tabs
  document.getElementById('close-all-tabs').addEventListener('click', function(e) {
    e.preventDefault();
    if (confirm('Close all tabs?')) {
      // First create a new tab
      chrome.tabs.create({ url: 'chrome://newtab' }, function(newTab) {
        // Then get all other tabs and close them
        chrome.tabs.query({}, function(tabs) {
          const tabsToClose = tabs
            .filter(tab => tab.id !== newTab.id)
            .map(tab => tab.id);
          
          // Close all other tabs
          chrome.tabs.remove(tabsToClose, function() {
            if (chrome.runtime.lastError) {
              console.error(chrome.runtime.lastError);
            }
            // Update the tab list
            setTimeout(listTabs, 100);
          });
        });
      });
    }
  });

  // Close other tabs
  document.getElementById('close-others').addEventListener('click', function(e) {
    e.preventDefault();
    if (confirm('Close all other tabs?')) {
      chrome.tabs.query({ active: true, currentWindow: true }, function(activeTabs) {
        const activeTab = activeTabs[0];
        
        chrome.tabs.query({}, function(tabs) {
          tabs.forEach(tab => {
            if (tab.id !== activeTab.id) {
              safeRemoveTab(tab.id);
            }
          });
          
          setTimeout(listTabs, 100);
        });
      });
    }
  });

  // Initialize
  listTabs();
});