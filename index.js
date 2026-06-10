import { chat } from '../../../../script.js';

const extensionName = 'ST-Multi-Deleter';
let isDeleteMode = false;
let isProcessing = false;
let selectedIds = new Set();
let lastClickedId = null;

// ================= CSS 样式 (全面接入酒馆自适应主题) =================
const styleHtml = `
<style>
    .md-click-catcher { position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1000; cursor: pointer; border-radius: 10px; transition: all 0.2s ease; }
    .mes.md-selected .md-click-catcher { background: rgba(255, 71, 87, 0.15); border: 2px solid #ff4757; backdrop-filter: brightness(0.7); }
    .mes.md-selected .md-click-catcher::after {
        content: '✓'; position: absolute; right: 15px; top: 15px; background: #ff4757; color: white; width: 24px; height: 24px;
        border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);
    }
    
    .md-nuke-grid { display: flex; flex-direction: column; gap: 6px; }
    .md-nuke-card {
        background: var(--SmartThemeBlurTintColor); border: 1px solid var(--SmartThemeBorderColor);
        border-radius: 6px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; transition: transform 0.2s, opacity 0.2s;
    }
    .md-nuke-card:hover { border-color: var(--SmartThemeQuoteColor); filter: brightness(1.1); }
    
    /* 撤出按钮：保留固定底色，使用纯白文字 */
    .md-spare-btn {
        background: #10ac84; color: white !important; border: none; border-radius: 4px; padding: 4px 8px;
        font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: 0.2s;
    }
    .md-spare-btn:hover { filter: brightness(1.2); transform: scale(1.05); }

    .md-mask { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.75); z-index: 20000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(4px); overflow: hidden; }
    
    .md-win {
        position: relative; width: 95vw; max-width: 700px; height: 85vh; max-height: 85vh;
        background: var(--SmartThemeBlurTintColor); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        border: 1px solid var(--SmartThemeBorderColor); border-radius: 12px; overflow: hidden; 
        color: var(--SmartThemeBodyColor); /* ★ 全局自适应文字颜色 */
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }

    #multi-delete-panel { display: flex; flex-direction: column; gap: 10px; padding: 12px; background: var(--SmartThemeBlurTintColor); border: 1px solid var(--SmartThemeBorderColor); border-radius: 8px; margin-bottom: 5px; }
    #multi-delete-panel input[type="text"] { background: var(--SmartThemeBlurTintColor); border: 1px solid var(--SmartThemeBorderColor); color: var(--SmartThemeBodyColor); border-radius: 4px; padding: 5px 8px; font-size: 13px; outline: none; }
    
    /* 自适应按钮样式 */
    .md-theme-btn { color: var(--SmartThemeBodyColor); border: 1px solid var(--SmartThemeBorderColor); border-radius: 5px; cursor: pointer; transition: 0.2s; font-size: 12px; padding: 6px 10px; }
    .md-theme-btn:hover { filter: brightness(1.2); }
    .md-theme-btn:active { transform: scale(0.95); }

    @media (max-width: 450px) {
        .md-txt-full { display: none !important; }
        .md-txt-short { display: inline !important; }
    }
    @media (min-width: 451px) {
        .md-txt-short { display: none !important; }
    }
</style>`;
$('head').append(styleHtml);

// ================= 核心逻辑 =================
function getChatArray() {
    const context = window.SillyTavern?.getContext?.();
    return context?.chat || chat;
}

function toggleMode() {
    if (isProcessing) return;
    isDeleteMode = !isDeleteMode;
    const btn = document.getElementById('multi-delete-open-btn');
    
    if (isDeleteMode) {
        if(btn) btn.classList.add('success');
        selectedIds.clear();
        lastClickedId = null;
        showControlPanel();
        injectClickCatchers();
    } else {
        if(btn) btn.classList.remove('success');
        hideControlPanel();
        removeClickCatchers();
        closeModal();
    }
}

function injectClickCatchers() {
    $('.mes').each(function() {
        const mesId = $(this).attr('mesid');
        if (mesId !== undefined && $(this).find('.md-click-catcher').length === 0) {
            if ($(this).css('position') === 'static') $(this).css('position', 'relative');
            const catcher = $(`<div class="md-click-catcher" data-mesid="${mesId}"></div>`);
            catcher.on('click', function(e) {
                e.stopPropagation(); 
                handleBubbleClick(parseInt(mesId), e.shiftKey);
            });
            $(this).append(catcher);
        }
    });
}

function removeClickCatchers() {
    $('.md-click-catcher').remove();
    $('.mes').removeClass('md-selected');
}

function handleBubbleClick(id, isShiftPressed) {
    if (isShiftPressed && lastClickedId !== null && lastClickedId !== id) {
        const start = Math.min(id, lastClickedId);
        const end = Math.max(id, lastClickedId);
        const isTargetChecked = !selectedIds.has(id); 
        for (let i = start; i <= end; i++) {
            if ($(`.mes[mesid="${i}"]`).length > 0) {
                if (isTargetChecked) selectedIds.add(i);
                else selectedIds.delete(i);
                updateBubbleVisuals(i);
            }
        }
    } else {
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
        updateBubbleVisuals(id);
    }
    lastClickedId = id;
    updatePanelCount();
}

function updateBubbleVisuals(id) {
    const bubble = $(`.mes[mesid="${id}"]`);
    if (selectedIds.has(id)) bubble.addClass('md-selected');
    else bubble.removeClass('md-selected');
}

// ================= 控制面板 =================
function showControlPanel() {
    if (document.getElementById('multi-delete-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'multi-delete-panel';
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; border-bottom: 1px solid var(--SmartThemeBorderColor); padding-bottom: 8px;">
            <span id="multi-delete-count" style="font-weight: bold; color: var(--SmartThemeBodyColor); font-size: 14px; white-space: nowrap;">已选 0 条</span>
            <div style="display: flex; align-items: center; gap: 5px;">
                <input type="text" id="md-range-input" placeholder="如:0-12" style="width: 100px;">
                <button id="md-btn-range" class="md-theme-btn" style="background: var(--SmartThemeQuoteColor); color: white !important; border:none;">范围选中</button>
            </div>
        </div>
        <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 8px;">
            <button id="md-btn-all" class="md-theme-btn" style="background: var(--SmartThemeBlurTintColor);">全选</button>
            <button id="md-btn-inv" class="md-theme-btn" style="background: var(--SmartThemeBlurTintColor);">反选</button>
            <button id="md-btn-down" class="md-theme-btn" style="background: var(--SmartThemeBlurTintColor);">向下全选</button>
            <button id="multi-delete-exec-btn" class="md-theme-btn" style="background: #ff4757; color: white !important; font-weight: bold; border:none;"><i class="fa-solid fa-trash"></i> 删除</button>
            <button id="md-btn-cancel" class="md-theme-btn" style="background: var(--SmartThemeBlurTintColor);">取消</button>
        </div>
    `;

    const formSheld = document.getElementById('form_sheld');
    const sendForm = document.getElementById('send_form');
    if (formSheld && sendForm) {
        formSheld.insertBefore(panel, sendForm);
    } else {
        document.body.appendChild(panel);
    }

    $('#md-btn-all').on('click', () => {
        const cArray = getChatArray();
        for (let i = 0; i < cArray.length; i++) { selectedIds.add(i); updateBubbleVisuals(i); }
        updatePanelCount();
    });
    $('#md-btn-inv').on('click', () => {
        const cArray = getChatArray();
        for (let i = 0; i < cArray.length; i++) {
            if (selectedIds.has(i)) selectedIds.delete(i);
            else selectedIds.add(i);
            updateBubbleVisuals(i);
        }
        updatePanelCount();
    });
    $('#md-btn-down').on('click', () => {
        if (selectedIds.size === 0) return toastr.warning("请先点击选择一个起始楼层");
        const cArray = getChatArray();
        const startId = Math.min(...Array.from(selectedIds));
        for (let i = startId; i < cArray.length; i++) { selectedIds.add(i); updateBubbleVisuals(i); }
        updatePanelCount();
        toastr.success(`已向下全选 #${startId} 之后的所有楼层`);
    });

    $('#md-btn-range').on('click', () => {
        const cArray = getChatArray();
        const val = $('#md-range-input').val().trim();
        if (!val) return toastr.warning("请输入想要选中的楼层，例如: 0-12");
        let addedCount = 0;
        val.split(',').forEach(part => {
            const range = part.trim().split('-');
            if (range.length === 1) { 
                const id = parseInt(range[0]);
                if (!isNaN(id) && id >= 0 && id < cArray.length) {
                    selectedIds.add(id); updateBubbleVisuals(id); addedCount++;
                }
            } else if (range.length === 2) { 
                const start = parseInt(range[0]), end = parseInt(range[1]);
                if (!isNaN(start) && !isNaN(end)) {
                    for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
                        if (i >= 0 && i < cArray.length) {
                            selectedIds.add(i); updateBubbleVisuals(i); addedCount++;
                        }
                    }
                }
            }
        });
        updatePanelCount();
        if (addedCount > 0) { toastr.success("选中成功"); $('#md-range-input').val(''); } 
        else toastr.error("格式错误或无对应楼层");
    });

    $('#multi-delete-exec-btn').on('click', showReviewModal);
    $('#md-btn-cancel').on('click', toggleMode);
    updatePanelCount();
}

function hideControlPanel() {
    const panel = document.getElementById('multi-delete-panel');
    if(panel) panel.remove();
}

function updatePanelCount() {
    $('#multi-delete-count').text(`已选 ${selectedIds.size} 条`);
}

// ================= 防呆预览弹窗 =================
function getSafePreviewText(htmlText) {
    if (!htmlText) return "（空消息/图片）";
    const cleanText = htmlText.replace(/<[^>]*>?/gm, '').replace(/[\r\n]/g, ' ').trim();
    if (!cleanText) return "（空消息/图片）";
    const chars = Array.from(cleanText);
    let preview = chars.slice(0, 20).join('');
    if (chars.length > 20) preview += "...";
    return preview;
}

function showReviewModal() {
    if (selectedIds.size === 0) return toastr.warning("未选择任何消息 o^o", "提示");
    closeModal();
    
    const cArray = getChatArray();
    let userCount = 0, charCount = 0, sysCount = 0;
    const sortedIds = Array.from(selectedIds).sort((a, b) => a - b);
    
    const MAX_PREVIEW = 200;
    const previewIds = sortedIds.slice(0, MAX_PREVIEW);
    const hasMore = sortedIds.length > MAX_PREVIEW;
    
    let cardsHtml = '';
    previewIds.forEach(id => {
        const msg = cArray[id];
        const bubble = $(`.mes[mesid="${id}"]`);
        if (!msg && bubble.length === 0) return;
        
        let typeLabel = "角色";
        let isUser = false, isSystem = false, name = "Character", rawText = "";
        
        if (msg) {
            isUser = Boolean(msg.is_user); isSystem = Boolean(msg.is_system);
            name = msg.name || (isUser ? "You" : "Character");
            rawText = msg.mes || "";
        } else {
            isUser = bubble.attr('is_user') === 'true'; isSystem = bubble.attr('is_system') === 'true';
            name = (bubble.attr('ch_name') || '').trim() || (isUser ? "You" : "Character");
            rawText = bubble.find('.mes_text').html() || "";
        }
        
        if (isUser) { userCount++; typeLabel = "用户"; }
        else if (isSystem) { sysCount++; typeLabel = "系统"; }
        else { charCount++; }
        
        const textPreview = getSafePreviewText(rawText);
        
        cardsHtml += `
        <div class="md-nuke-card" id="md-card-${id}" style="flex-direction:row; align-items:center; gap:8px;">
            <span style="font-weight:bold; color:var(--SmartThemeQuoteColor); font-size:12px; white-space:nowrap;">#${id}</span>
            <span style="font-size:11px; color:var(--SmartThemeBodyColor); opacity:0.7; white-space:nowrap;">[${typeLabel}]${name}</span>
            <span style="font-size:12px; color:var(--SmartThemeBodyColor); opacity:0.9; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${textPreview}</span>
            <button class="md-spare-btn" data-id="${id}" style="flex-shrink:0;">
                <i class="fa-solid fa-rotate-left"></i>
            </button>
        </div>`;
    });
    
    if (hasMore) {
        sortedIds.slice(MAX_PREVIEW).forEach(id => {
            const msg = cArray[id];
            if (!msg) return;
            if (msg.is_user) userCount++;
            else if (msg.is_system) sysCount++;
            else charCount++;
        });
        cardsHtml += `<div style="text-align:center; padding:8px; color:var(--SmartThemeQuoteColor); font-size:12px;">
            仅预览前 ${MAX_PREVIEW} 条，共 ${sortedIds.length} 条将被处理
        </div>`;
    }

    const modalHtml = `
    <div id="md-review-modal" class="md-mask">
        <div class="md-win">
            
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 50px; padding: 0 20px; background: var(--SmartThemeBlurTintColor); border-bottom: 1px solid var(--SmartThemeBorderColor); font-weight: bold; font-size: 16px; display:flex; justify-content: space-between; align-items: center; z-index: 10;">
                <span style="color:var(--SmartThemeBodyColor);"><i class="fa-solid fa-trash-can-arrow-up"></i> 处理队列确认</span>
                <span style="font-size:13px; font-weight:normal; color: var(--SmartThemeQuoteColor);" id="md-queue-total">共 ${selectedIds.size} 条</span>
            </div>
            
            <div style="position: absolute; top: 50px; bottom: 60px; left: 0; right: 0; overflow-y: auto; padding: 15px; -webkit-overflow-scrolling: touch; z-index: 1;">
                <div style="display: flex; gap: 10px; font-size: 12px; color: var(--SmartThemeBodyColor); opacity:0.9; margin-bottom: 10px; padding: 8px; background: var(--SmartThemeBlurTintColor); border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; flex-wrap: wrap;">
                    <div>用户 <span style="font-weight:bold;">${userCount}</span></div>
                    <div>角色 <span style="font-weight:bold;">${charCount}</span></div>
                    <div>系统 <span style="font-weight:bold;">${sysCount}</span></div>
                </div>
                <div class="md-nuke-grid">${cardsHtml}</div>
            </div>
            
            <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 60px; padding: 0 15px; border-top: 1px solid var(--SmartThemeBorderColor); background: var(--SmartThemeBlurTintColor); display: flex; justify-content: space-between; align-items: center; z-index: 10;">
                <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:12px; color: var(--SmartThemeQuoteColor);">
                    <input type="checkbox" id="md-export-backup" style="width:14px; height:14px; cursor:pointer;"> 
                    <span class="md-txt-full"><i class="fa-solid fa-file-export"></i> 下载TXT备份</span>
                    <span class="md-txt-short"><i class="fa-solid fa-file-export"></i> 备份</span>
                </label>
                <div style="display:flex; gap:8px;">
                    <button id="md-modal-cancel" class="md-theme-btn" style="background: var(--SmartThemeBlurTintColor); padding: 6px 12px; cursor:pointer;">返回</button>
                    <button id="md-modal-move" class="md-theme-btn" style="background: #8e44ad; color: white !important; border:none; padding: 6px 12px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-truck-fast"></i> 搬家
                    </button>
                    <button id="md-modal-confirm" class="md-theme-btn" style="background: #ff4757; color: white !important; border:none; font-weight:bold; padding: 6px 12px; cursor:pointer;">确认删除</button>
                </div>
            </div>
        </div>
    </div>`;
    
    $('body').append(modalHtml);
    
    $('#md-modal-cancel').on('click', closeModal);
    $('#md-modal-confirm').on('click', () => executeDelete(false));
    $('#md-modal-move').on('click', () => executeDelete(true));
    
    $('#md-review-modal').on('click', '.md-spare-btn', function() {
        const id = parseInt($(this).data('id'));
        selectedIds.delete(id);
        updateBubbleVisuals(id);
        updatePanelCount();
        
        const card = $(`#md-card-${id}`);
        card.css({ transform: 'scale(0.8)', opacity: 0 });
        setTimeout(() => {
            card.remove(); 
            $('#md-queue-total').text(`共 ${selectedIds.size} 条`);
            if(selectedIds.size === 0) {
                closeModal();
                toastr.info("队列已清空");
            }
        }, 200);
    });
}

function closeModal() {
    $('#md-review-modal').remove();
}

// ================= 底层切除引擎 =================
function generateTXTBackup(idsToNuke) {
    try {
        const cArray = getChatArray();
        let content = "=== SillyTavern Deleted Messages Backup ===\n";
        content += `Date: ${new Date().toLocaleString()}\n\n`;
        idsToNuke.slice().reverse().forEach(id => {
            const msg = cArray[id];
            if(msg) {
                const name = msg.name || (msg.is_user ? "You" : "Character");
                content += `[ID: ${id}] ${name}:\n${msg.mes.replace(/<[^>]*>?/gm, '')}\n\n------------------------\n\n`;
            }
        });
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `ST_Deleted_Backup_${new Date().getTime()}.txt`;
        a.click(); URL.revokeObjectURL(url);
    } catch (e) {}
}

function generateChatFileForMove(idsToMove) {
    try {
        const cArray = getChatArray();
        let userName = "User", charName = "Character";
        for (let i = 0; i < cArray.length; i++) {
            if (cArray[i].is_user) userName = cArray[i].name || userName;
            if (!cArray[i].is_user && !cArray[i].is_system) charName = cArray[i].name || charName;
        }
        let jsonlContent = JSON.stringify({ user_name: userName, character_name: charName, create_date: Date.now(), chat_metadata: {} }) + "\n";
        idsToMove.slice().sort((a,b) => a - b).forEach(id => { if(cArray[id]) jsonlContent += JSON.stringify(cArray[id]) + "\n"; });
        const blob = new Blob([jsonlContent], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `搬出聊天_${charName}_${new Date().getTime()}.jsonl`;
        a.click(); URL.revokeObjectURL(url);
    } catch (e) {}
}

async function executeDelete(isMove = false) {
    if (selectedIds.size === 0) return closeModal();
    let finalIds = Array.from(selectedIds);

    isProcessing = true;
    if (isMove) {
        $('#md-modal-move').html('<i class="fa-solid fa-spinner fa-spin"></i> 打包中...ovo').css('pointer-events', 'none');
        generateChatFileForMove(finalIds);
    } else {
        $('#md-modal-confirm').html('<i class="fa-solid fa-spinner fa-spin"></i> 清理中...').css('pointer-events', 'none');
    }
    
    if ($('#md-export-backup').is(':checked')) generateTXTBackup(finalIds);

    const context = window.SillyTavern?.getContext?.();
    const cArray = context?.chat || chat;
    
    finalIds.sort((a, b) => b - a);
    let successCount = 0;
    
    try {
        for (const id of finalIds) {
            if (id >= 0 && id < cArray.length) {
                cArray.splice(id, 1);
                successCount++;
            }
        }
        
        if (successCount > 0) {
            if (typeof window.saveChat === 'function') await window.saveChat();
            if (context && typeof context.clearChat === 'function' && typeof context.printMessages === 'function') {
                await context.clearChat();
                await context.printMessages();
            } else if (typeof window.reloadCurrentChat === 'function') {
                window.reloadCurrentChat();
            }
        }
    } catch (e) {
        console.error("执行批量删除时遇到底层错误:", e);
    }

    if (successCount > 0) {
        if (isMove) toastr.success(`成功搬走 ${successCount} 条信息！请使用导入聊天功能`, "搬家完成", {timeOut: 8000});
        else toastr.success(`成功抹除了 ${successCount} 条信息`);
    } else {
        toastr.error("清理失败，可能是数据已被折叠或锁定 o^o");
    }
    
    isProcessing = false;
    closeModal();
    toggleMode();
}

// ================= 插件入口 =================
jQuery(() => {
    const checkBtn = setInterval(() => {
        const bar = document.getElementById('extensionsMenu');
        if (bar && !document.getElementById('multi-delete-open-btn')) {
            const btn = document.createElement('div');
            btn.id = 'multi-delete-open-btn';
            btn.className = 'list-group-item flex-container flex-gap-10 interactable';
            btn.innerHTML = '<div class="fa-solid fa-list-check"></div><div>批量删除信息</div>'; 
            btn.addEventListener('click', toggleMode);
            bar.appendChild(btn);
            clearInterval(checkBtn);
            console.log(`${extensionName} 加载完成`);
        }
    }, 1000); 
});
