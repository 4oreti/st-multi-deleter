import { chat, deleteMessage } from '../../../../script.js';

const extensionName = 'ST-Multi-Deleter';
let isDeleteMode = false;
let isProcessing = false;
let selectedIds = new Set();
let lastClickedId = null;

// ================= CSS 样式 =================
const styleHtml = `
<style>
    .md-click-catcher {
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        z-index: 1000; cursor: pointer; border-radius: 10px;
        transition: all 0.2s ease;
    }
    .mes.md-selected .md-click-catcher {
        background: rgba(255, 71, 87, 0.15);
        border: 2px solid #ff4757;
        backdrop-filter: brightness(0.7);
    }
    .mes.md-selected .md-click-catcher::after {
        content: '✓'; position: absolute; right: 15px; top: 15px;
        background: #ff4757; color: white; width: 24px; height: 24px;
        border-radius: 50%; display: flex; align-items: center; justify-content: center;
        font-weight: bold; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);
    }
    .md-nuke-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
    .md-nuke-card {
        background: rgba(255, 71, 87, 0.08); border: 1px solid rgba(255, 71, 87, 0.3);
        border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s;
    }
    .md-nuke-card:hover { border-color: rgba(255, 71, 87, 0.8); background: rgba(255, 71, 87, 0.15); }
    .md-spare-btn {
        background: #10ac84; color: white; border: none; border-radius: 4px; padding: 4px 8px;
        font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;
    }
    .md-spare-btn:hover { background: #1dd1a1 !important; transform: scale(1.05); }
</style>`;
$('head').append(styleHtml);

// ================= 核心逻辑 =================
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

// ================= ★ 终极修复：使用 safe-area-inset-bottom 适配所有手机屏幕！ =================
function showControlPanel() {
    if (!document.getElementById('multi-delete-panel')) {
        // 关键修复：使用 calc() 和 env(safe-area-inset-bottom) 智能计算底部边距
        const bottomOffset = 'calc(20px + env(safe-area-inset-bottom, 0px))';
        
        const html = `
        <div id="multi-delete-panel" style="position: fixed; bottom: ${bottomOffset}; left: 10px; right: 10px; margin: 0 auto; max-width: 600px; z-index: 2147483647; background: rgba(20,20,20,0.95); backdrop-filter: blur(10px); border-radius: 12px; border: 1px solid #555; padding: 12px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.8);">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                <span id="multi-delete-count" style="font-weight: bold; color: white; font-size: 14px; white-space: nowrap;">已选 0 条</span>
                <div style="display: flex; align-items: center; gap: 5px;">
                    <input type="text" id="md-range-input" placeholder="如:0-12" style="width: 100px; background: rgba(0,0,0,0.6); border: 1px solid #777; color: white; border-radius: 4px; padding: 5px 8px; font-size: 13px; outline: none;">
                    <button id="md-btn-range" class="menu_button interactable" style="background: #8e44ad; color: white; border: none; padding: 5px 10px; border-radius: 5px; font-size: 13px;">范围选中</button>
                </div>
            </div>
            <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 8px;">
                <button id="md-btn-all" class="menu_button interactable" style="background: #3498db; color: white; border: none; padding: 6px 10px; border-radius: 5px; font-size: 12px;">全选</button>
                <button id="md-btn-inv" class="menu_button interactable" style="background: #16a085; color: white; border: none; padding: 6px 10px; border-radius: 5px; font-size: 12px;">反选</button>
                <button id="md-btn-down" class="menu_button interactable" style="background: #e67e22; color: white; border: none; padding: 6px 10px; border-radius: 5px; font-size: 12px;">向下全选</button>
                <button id="multi-delete-exec-btn" class="menu_button interactable" style="background: #ff4757; color: white; border: none; padding: 6px 12px; border-radius: 5px; font-weight: bold; font-size: 12px;"><i class="fa-solid fa-trash"></i> 删除</button>
                <button id="md-btn-cancel" class="menu_button interactable" style="background: #747d8c; color: white; border: none; padding: 6px 10px; border-radius: 5px; font-size: 12px;">取消</button>
            </div>
        </div>`;
        $('body').append(html);

        $('#md-btn-all').on('click', () => {
            $('.mes[mesid]').each(function() {
                const id = parseInt($(this).attr('mesid'));
                if(!isNaN(id)) { selectedIds.add(id); updateBubbleVisuals(id); }
            });
            updatePanelCount();
        });
        $('#md-btn-inv').on('click', () => {
            $('.mes[mesid]').each(function() {
                const id = parseInt($(this).attr('mesid'));
                if(!isNaN(id)) {
                    if (selectedIds.has(id)) selectedIds.delete(id);
                    else selectedIds.add(id);
                    updateBubbleVisuals(id);
                }
            });
            updatePanelCount();
        });
        $('#md-btn-down').on('click', () => {
            if (selectedIds.size === 0) return toastr.warning("请先点击选择一个起始楼层 o-o");
            const startId = Math.min(...Array.from(selectedIds));
            $('.mes[mesid]').each(function() {
                const id = parseInt($(this).attr('mesid'));
                if(!isNaN(id) && id >= startId) {
                    selectedIds.add(id);
                    updateBubbleVisuals(id);
                }
            });
            updatePanelCount();
            toastr.success(`已向下全选 #${startId} 之后的所有楼层 ovo`);
        });

        $('#md-btn-range').on('click', () => {
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
                    const start = parseInt(range[0]), end = parseInt(range[1]);
                    if (!isNaN(start) && !isNaN(end)) {
                        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
                            if ($(`.mes[mesid="${i}"]`).length > 0) {
                                selectedIds.add(i); updateBubbleVisuals(i); addedCount++;
                            }
                        }
                    }
                }
            });
            updatePanelCount();
            if (addedCount > 0) { toastr.success("选中成功 ovo"); $('#md-range-input').val(''); } 
            else toastr.error("格式错误或无对应楼层");
        });

        $('#multi-delete-exec-btn').on('click', showReviewModal);
        $('#md-btn-cancel').on('click', toggleMode);
    }
    $('#multi-delete-panel').show();
    updatePanelCount();
}

function hideControlPanel() {
    $('#multi-delete-panel').hide();
}

function updatePanelCount() {
    $('#multi-delete-count').text(`已选 ${selectedIds.size} 条`);
}

// ================= 防呆弹窗 (也加上了防按钮挤出修复) =================
function showReviewModal() {
    if (selectedIds.size === 0) return toastr.warning("未选择任何消息 o^o", "提示");
    closeModal();
    
    let userCount = 0, charCount = 0, sysCount = 0;
    const sortedIds = Array.from(selectedIds).sort((a, b) => a - b);
    
    let cardsHtml = '';
    sortedIds.forEach(id => {
        const bubble = $(`.mes[mesid="${id}"]`);
        if (bubble.length === 0) return;
        let typeLabel = "角色";
        const isUser = bubble.attr('is_user') === 'true';
        const isSystem = bubble.attr('is_system') === 'true';
        if (isUser) { userCount++; typeLabel = "用户"; }
        else if (isSystem) { sysCount++; typeLabel = "系统"; }
        else { charCount++; }
        let name = (bubble.attr('ch_name') || '').trim() || (isUser ? "You" : "Character");
        let textPreview = bubble.find('.mes_text').text().replace(/\n/g, ' ').trim().substring(0, 150) || "（空消息/图片）";
        
        cardsHtml += `
        <div class="md-nuke-card" id="md-card-${id}">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.2); padding-bottom: 6px;">
                <div style="display:flex; align-items:center;">
                    <span style="font-weight: bold; color: #ff6b81; font-size: 13px;">#${id}</span>
                    <span style="font-size: 12px; color: #ccc; margin-left: 8px;">[${typeLabel}] ${name}</span>
                </div>
                <button class="md-spare-btn" data-id="${id}">
                    <i class="fa-solid fa-rotate-left"></i> 撤出
                </button>
            </div>
            <div style="font-size: 13px; color: #ddd; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${textPreview}</div>
        </div>`;
    });

    const modalHtml = `
    <div id="md-review-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 2147483647; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); padding: 10px;">
        <div style="background: #222; width: 100%; max-width: 700px; height: 85vh; border-radius: 12px; border: 1px solid #555; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.6);">
            <div style="flex-shrink: 0; padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: bold; font-size: 18px; display:flex; justify-content: space-between; align-items: center;">
                <span><i class="fa-solid fa-trash-can-arrow-up"></i> 处理队列确认</span>
                <span style="font-size:14px; font-weight:normal; color:#ff6b81;" id="md-queue-total">共 ${selectedIds.size} 条</span>
            </div>
            <div style="flex: 1 1 auto; overflow-y: auto; min-height: 0; padding: 15px; background: rgba(0,0,0,0.2);">
                <div style="display: flex; gap: 15px; font-size: 13px; color: #aaa; margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; flex-wrap: wrap;">
                    <div>包含：用户发言 <span style="color:#fff;font-weight:bold;">${userCount}</span> 条</div>
                    <div>角色发言 <span style="color:#fff;font-weight:bold;">${charCount}</span> 条</div>
                    <div>系统提示 <span style="color:#fff;font-weight:bold;">${sysCount}</span> 条</div>
                </div>
                <div class="md-nuke-grid">${cardsHtml}</div>
            </div>
            <div style="flex-shrink: 0; padding: 15px 20px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap:10px;">
                <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:13px; color:#f39c12;">
                    <input type="checkbox" id="md-export-backup" style="accent-color:#f39c12; width:16px; height:16px; cursor:pointer;"> 
                    <i class="fa-solid fa-file-export"></i> 删除前下载TXT备份
                </label>
                <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content: flex-end;">
                    <button id="md-modal-cancel" class="menu_button interactable" style="background: #747d8c; padding: 6px 12px; cursor:pointer;">返回</button>
                    <button id="md-modal-move" class="menu_button interactable" style="background: #8e44ad; color: white; border: none; border-radius: 5px; padding: 6px 12px; font-weight:bold; cursor:pointer;" title="打包成.jsonl文件并移除">
                        <i class="fa-solid fa-truck-fast"></i> 搬家
                    </button>
                    <button id="md-modal-confirm" class="menu_button interactable" style="background: #ff4757; font-weight:bold; padding: 6px 12px; cursor:pointer;">确认删除</button>
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
                toastr.info("队列已清空 ovo");
            }
        }, 200);
    });
}

function closeModal() {
    $('#md-review-modal').remove();
}

// ================= 导出与操作 =================
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
    if (isMove) {
        $('#md-modal-move').html('<i class="fa-solid fa-spinner fa-spin"></i> 打包中...ovo').css('pointer-events', 'none');
        generateChatFileForMove(finalIds);
    } else {
        $('#md-modal-confirm').html('<i class="fa-solid fa-spinner fa-spin"></i> 处理中...ovo').css('pointer-events', 'none');
    }
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
            console.log(`${extensionName} 终极适配版加载完成 ovo`);
        }
    }, 1000); 
});
