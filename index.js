import { chat, deleteMessage } from '../../../../script.js';

const extensionName = 'ST-Multi-Deleter';
let isDeleteMode = false;
let isProcessing = false;
let selectedIds = new Set();
let lastClickedId = null;

// ================= CSS 样式 (复刻备份助手的高级质感) =================
const styleHtml = `
<style>
    /* 拦截遮罩与气泡选中特效 (稍微调淡了一点，显得更高级) */
    .md-click-catcher { position: absolute; inset: 0; z-index: 1000; cursor: pointer; border-radius: 10px; transition: all 0.2s ease; }
    .mes.md-selected .md-click-catcher { background: rgba(111, 168, 220, 0.15); border: 2px solid #6fa8dc; backdrop-filter: brightness(0.8); }
    .mes.md-selected .md-click-catcher::after {
        content: '✓'; position: absolute; right: 15px; top: 15px; background: #6fa8dc; color: white; 
        width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
        font-weight: bold; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);
    }
    
    /* ★ 弹窗与遮罩 (完美复刻备份助手) */
    .md-mask { 
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
        background: rgba(0, 0, 0, 0.75); z-index: 20000; 
        display: flex; justify-content: center; align-items: center; 
        backdrop-filter: blur(4px); overflow: hidden; 
    }
    .md-win { 
        position: relative; width: 95vw; max-width: 600px; max-height: 85vh; 
        background-color: var(--SmartThemeBgColor, #1a1a1a); 
        border: 1px solid var(--SmartThemeBorderColor, #444); 
        border-radius: 12px; display: flex; flex-direction: column; 
        box-shadow: 0 20px 60px rgba(0,0,0,0.8); overflow: hidden;
    }
    .md-head { 
        padding: 15px 20px; background: rgba(0,0,0,0.3); 
        border-bottom: 1px solid var(--SmartThemeBorderColor, #333); 
        display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; 
    }
    .md-head h3 { margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 10px; color: var(--SmartThemeBodyColor, #eee); }
    .md-content { padding: 15px 20px; flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
    
    /* 列表项 (取代之前的网格卡片) */
    .md-list { display: flex; flex-direction: column; gap: 10px; }
    .md-item { 
        background: rgba(255,255,255,0.03); border-radius: 8px; 
        border: 1px solid rgba(255,255,255,0.05); padding: 12px 15px; 
        display: flex; flex-direction: column; gap: 6px; transition: all 0.2s; 
    }
    .md-item-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 6px; }
    .md-item-title { font-weight: bold; color: var(--SmartThemeQuoteColor, #6fa8dc); font-size: 0.95em; }
    .md-item-text { font-size: 0.9em; color: #ccc; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    
    /* 底部与按钮区 */
    .md-foot { padding: 15px 20px; border-top: 1px solid rgba(255,255,255,0.05); flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; background: rgba(0,0,0,0.2); }
    .md-actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
    
    /* 高级渐变按钮 */
    .md-btn { 
        padding: 10px 16px; border: none; border-radius: 8px; 
        font-size: 0.9rem; font-weight: bold; cursor: pointer;
        color: white; transition: 0.2s; display: flex; align-items: center; gap: 6px;
    }
    .md-btn:active { transform: translateY(2px); box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
    .md-btn.primary { background: linear-gradient(135deg, #6fa8dc, #4a90e2); box-shadow: 0 4px 15px rgba(74, 144, 226, 0.3); }
    .md-btn.danger { background: linear-gradient(135deg, #ff6b6b, #d32f2f); box-shadow: 0 4px 15px rgba(211, 47, 47, 0.3); }
    .md-btn.purple { background: linear-gradient(135deg, #b19cd9, #8e44ad); box-shadow: 0 4px 15px rgba(142, 68, 173, 0.3); }
    .md-btn.gray { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); box-shadow: none; }
    .md-btn.gray:hover { background: rgba(255,255,255,0.15); }
    .md-btn-small { padding: 4px 10px; font-size: 0.8rem; border-radius: 6px; background: rgba(255,255,255,0.1); color: #ccc; border: none; cursor: pointer; transition: 0.2s; }
    .md-btn-small:hover { background: rgba(255,255,255,0.2); color: white; }

    /* 警告框 */
    .md-warning-box { 
        background: rgba(255, 68, 68, 0.1); border: 1px solid rgba(255, 68, 68, 0.4); 
        color: #ff8e8e; padding: 12px; border-radius: 8px; margin-bottom: 15px; font-size: 0.9em;
    }
</style>`;
document.head.insertAdjacentHTML('beforeend', styleHtml);

// ================= 全局方法绑定 =================
window.multiDeleter = {
    toggleMode() {
        if (isProcessing) return;
        isDeleteMode = !isDeleteMode;
        const btn = document.getElementById('multi-delete-open-btn');
        if (isDeleteMode) {
            if(btn) btn.classList.add('success');
            selectedIds.clear();
            lastClickedId = null;
            injectClickCatchers();
            showControlPanel(); // 注入到底部聊天框上方
        } else {
            if(btn) btn.classList.remove('success');
            removeClickCatchers();
            hideControlPanel();
            closeModal();
        }
    },
    selectRange() {
        const val = $('#md-range-input').val().trim();
        if (!val) return toastr.warning("请输入想要选中的楼层，例如: 0-12");
        let addedCount = 0;
        val.split(',').forEach(part => {
            const range = part.trim().split('-');
            if (range.length === 1) { 
                const id = parseInt(range[0]);
                if (!isNaN(id) && $(`.mes[mesid="${id}"]`).length > 0) {
                    selectedIds.add(id); updateBubbleVisuals(id); addedCount++;
                }
            } else if (range.length === 2) { 
                for (let i = Math.min(range[0], range[1]); i <= Math.max(range[0], range[1]); i++) {
                    if ($(`.mes[mesid="${i}"]`).length > 0) {
                        selectedIds.add(i); updateBubbleVisuals(i); addedCount++;
                    }
                }
            }
        });
        updatePanelCount();
        if (addedCount > 0) { toastr.success("选中成功 ovo"); $('#md-range-input').val(''); }
    },
    selectAll() {
        $('.mes[mesid]').each(function() {
            const id = parseInt($(this).attr('mesid'));
            if(!isNaN(id)) { selectedIds.add(id); updateBubbleVisuals(id); }
        });
        updatePanelCount();
    },
    selectDown() {
        if (selectedIds.size === 0) return toastr.warning("请先点击选择一个起始楼层 o-o");
        const startId = Math.min(...Array.from(selectedIds));
        $('.mes[mesid]').each(function() {
            const id = parseInt($(this).attr('mesid'));
            if(!isNaN(id) && id >= startId) { selectedIds.add(id); updateBubbleVisuals(id); }
        });
        updatePanelCount();
        toastr.success(`已向下全选 #${startId} 之后的所有楼层 ovo`);
    },
    openReview() { showReviewModal(); },
    spare(id) {
        selectedIds.delete(id);
        updateBubbleVisuals(id);
        updatePanelCount();
        $(`#md-item-${id}`).slideUp(200, function() { 
            $(this).remove(); 
            $('#md-queue-total').text(`共 ${selectedIds.size} 条`);
            if(selectedIds.size === 0) { closeModal(); toastr.info("队列已清空 ovo"); }
        });
    },
    execMove() { executeDelete(true); },
    execDelete() { executeDelete(false); },
    closeReview() { closeModal(); }
};

// ================= 气泡点击事件 =================
function injectClickCatchers() {
    $('.mes').each(function() {
        const mesId = $(this).attr('mesid');
        if (mesId !== undefined && $(this).find('.md-click-catcher').length === 0) {
            if ($(this).css('position') === 'static') $(this).css('position', 'relative');
            const catcher = $(`<div class="md-click-catcher" data-mesid="${mesId}"></div>`);
            catcher.on('click', function(e) {
                e.stopPropagation(); 
                const id = parseInt(mesId);
                if (e.shiftKey && lastClickedId !== null && lastClickedId !== id) {
                    const isTargetChecked = !selectedIds.has(id); 
                    for (let i = Math.min(id, lastClickedId); i <= Math.max(id, lastClickedId); i++) {
                        if ($(`.mes[mesid="${i}"]`).length > 0) {
                            if (isTargetChecked) selectedIds.add(i); else selectedIds.delete(i);
                            updateBubbleVisuals(i);
                        }
                    }
                } else {
                    if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
                    updateBubbleVisuals(id);
                }
                lastClickedId = id;
                updatePanelCount();
            });
            $(this).append(catcher);
        }
    });
}

function removeClickCatchers() {
    $('.md-click-catcher').remove();
    $('.mes').removeClass('md-selected');
}

function updateBubbleVisuals(id) {
    if (selectedIds.has(id)) $(`.mes[mesid="${id}"]`).addClass('md-selected');
    else $(`.mes[mesid="${id}"]`).removeClass('md-selected');
}

function updatePanelCount() {
    const countEl = document.getElementById('md-win-count');
    if(countEl) countEl.innerText = `已选 ${selectedIds.size} 条`;
}

// ================= 底部操作栏 (附着于聊天框上方) =================
function showControlPanel() {
    if (document.getElementById('md-action-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'md-action-bar';
    bar.style.cssText = "display: flex; flex-direction: column; gap: 10px; padding: 15px; background: rgba(0,0,0,0.2); border-top: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.1)); border-bottom: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.1)); margin-bottom: 5px;";
    
    bar.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span id="md-win-count" style="font-weight: bold; color: var(--SmartThemeQuoteColor, #6fa8dc); font-size: 14px;">已选 0 条</span>
                <button class="md-btn-small" onclick="window.multiDeleter.selectAll()">全选</button>
                <button class="md-btn-small" onclick="window.multiDeleter.selectDown()">向下</button>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <input type="text" id="md-range-input" placeholder="0-12" style="width: 70px; background: rgba(0,0,0,0.5); border: 1px solid #555; color: white; border-radius: 6px; padding: 5px 8px; font-size: 13px; outline: none;">
                <button class="md-btn-small" style="background: rgba(111, 168, 220, 0.2); color: #6fa8dc;" onclick="window.multiDeleter.selectRange()">范围选</button>
            </div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end;">
            <button class="md-btn gray" onclick="window.multiDeleter.toggleMode()">取消退出</button>
            <button class="md-btn danger" onclick="window.multiDeleter.openReview()"><i class="fa-solid fa-list-check"></i> 预览处理</button>
        </div>
    `;

    const formSheld = document.getElementById('form_sheld');
    const sendForm = document.getElementById('send_form');
    
    if (formSheld && sendForm) {
        formSheld.insertBefore(bar, sendForm);
    } else {
        bar.style.position = 'fixed'; bar.style.bottom = '80px'; bar.style.left = '10px'; bar.style.right = '10px'; bar.style.zIndex = '20000'; bar.style.borderRadius = '10px';
        document.body.appendChild(bar);
    }
}

function hideControlPanel() {
    const bar = document.getElementById('md-action-bar');
    if(bar) bar.remove();
}

// ================= ★ 完美质感：列表式防呆预览弹窗 =================
function showReviewModal() {
    if (selectedIds.size === 0) return toastr.warning("未选择任何消息 o^o", "提示");
    closeModal();
    
    let listHtml = '';
    Array.from(selectedIds).sort((a, b) => a - b).forEach(id => {
        const bubble = $(`.mes[mesid="${id}"]`);
        if (bubble.length === 0) return;
        
        let typeLabel = "角色";
        const isUser = bubble.attr('is_user') === 'true';
        if (isUser) typeLabel = "用户";
        else if (bubble.attr('is_system') === 'true') typeLabel = "系统";
        
        let name = (bubble.attr('ch_name') || '').trim() || (isUser ? "You" : "Character");
        let textPreview = bubble.find('.mes_text').text().replace(/\n/g, ' ').trim().substring(0, 150) || "（空消息/图片）";
        
        // 采用列表项排版，一目了然
        listHtml += `
        <div class="md-item" id="md-item-${id}">
            <div class="md-item-head">
                <span class="md-item-title">#${id} [${typeLabel}] ${name}</span>
                <button class="md-btn-small" onclick="window.multiDeleter.spare(${id})">保留撤出</button>
            </div>
            <div class="md-item-text">${textPreview}</div>
        </div>`;
    });

    const modalHtml = `
    <div id="md-review-modal" class="md-mask">
        <div class="md-win">
            <div class="md-head">
                <h3><i class="fa-solid fa-clipboard-list"></i> 批量处理预览</h3>
                <div style="cursor:pointer; opacity:0.6;" onclick="window.multiDeleter.closeReview()">✕</div>
            </div>
            
            <div class="md-content">
                <div class="md-warning-box">
                    <div style="font-weight:bold; margin-bottom:5px;"><i class="fa-solid fa-triangle-exclamation"></i> 操作提醒</div>
                    将对选中的 <strong id="md-queue-total">${selectedIds.size}</strong> 条消息进行操作。<br>
                    若发现误选，请点击对应消息的“保留撤出”。
                </div>
                <div class="md-list">${listHtml}</div>
            </div>
            
            <div class="md-foot">
                <label style="color:#aaa; font-size:13px; display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" id="md-export-backup" style="cursor:pointer;"> 
                    <i class="fa-solid fa-file-arrow-down"></i> 执行前顺便下载 TXT 备份
                </label>
                <div class="md-actions">
                    <button class="md-btn gray" onclick="window.multiDeleter.closeReview()">返回修改</button>
                    <button class="md-btn purple" onclick="window.multiDeleter.execMove()">
                        <i class="fa-solid fa-truck-fast"></i> 搬家导出
                    </button>
                    <button id="md-btn-final-del" class="md-btn danger" onclick="window.multiDeleter.execDelete()">
                        <i class="fa-solid fa-trash-can"></i> 确认删除
                    </button>
                </div>
            </div>
        </div>
    </div>`;
    
    $('body').append(modalHtml);
}

function closeModal() {
    $('#md-review-modal').remove();
}

// ================= 导出与执行 =================
function generateTXTBackup(idsToNuke) {
    try {
        let content = "=== SillyTavern Deleted Messages Backup ===\n";
        content += `Date: ${new Date().toLocaleString()}\n\n`;
        idsToNuke.slice().reverse().forEach(id => {
            const msg = chat[id];
            if(msg) {
                const name = msg.name || (msg.is_user ? "You" : "Character");
                content += `[ID: ${id}] ${name}:\n${msg.mes}\n\n------------------------\n\n`;
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
        let userName = "User", charName = "Character";
        for (let i = 0; i < chat.length; i++) {
            if (chat[i].is_user) userName = chat[i].name || userName;
            if (!chat[i].is_user && !chat[i].is_system) charName = chat[i].name || charName;
        }
        let jsonlContent = JSON.stringify({ user_name: userName, character_name: charName, create_date: Date.now(), chat_metadata: {} }) + "\n";
        idsToMove.slice().sort((a,b) => a - b).forEach(id => { if(chat[id]) jsonlContent += JSON.stringify(chat[id]) + "\n"; });
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
    const btnDel = document.getElementById('md-btn-final-del');
    if (btnDel) { btnDel.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 处理中...ovo'; btnDel.style.pointerEvents = 'none'; }
    
    if (isMove) generateChatFileForMove(finalIds);
    if ($('#md-export-backup').is(':checked')) generateTXTBackup(finalIds);

    finalIds.sort((a, b) => b - a);
    let successCount = 0;
    for (const id of finalIds) {
        if (id < chat.length) {
            await deleteMessage(id);
            successCount++;
        }
    }

    if (successCount > 0) {
        if (isMove) toastr.success(`成功搬走 ${successCount} 条信息！请使用酒馆的【导入聊天】功能 ovo`, "搬家完成 ovo", {timeOut: 8000});
        else toastr.success(`成功删除${successCount}条信息 ovo`);
    }
    
    isProcessing = false;
    closeModal();
    window.multiDeleter.toggleMode(); // 彻底退出
}

// ================= 插件入口 =================
jQuery(() => {
    const checkBtn = setInterval(() => {
        const menu = document.getElementById('extensionsMenu');
        if (menu && !document.getElementById('multi-delete-open-btn')) {
            const btn = document.createElement('div');
            btn.id = 'multi-delete-open-btn';
            btn.className = 'list-group-item flex-container flex-gap-10 interactable';
            btn.innerHTML = '<div class="fa-solid fa-list-check"></div><div>批量删除信息</div>'; 
            btn.onclick = window.multiDeleter.toggleMode;
            menu.appendChild(btn);
            clearInterval(checkBtn);
            console.log(`${extensionName} 质感拉满版加载完成 ovo`);
        }
    }, 1000); 
});
