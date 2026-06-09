import { chat, deleteMessage } from '../../../../script.js';

const extensionName = 'ST-Multi-Deleter';
let isDeleteMode = false;
let isProcessing = false;
let selectedIds = new Set();
let lastClickedId = null;

// ================= ★ 样式：全面自适应酒馆主题 =================
const styleHtml = `
<style>
    /* 拦截遮罩与选中效果 */
    .md-click-catcher { position: absolute; inset: 0; z-index: 1000; cursor: pointer; border-radius: 10px; transition: all 0.2s; }
    .mes.md-selected .md-click-catcher {
        background: rgba(255, 71, 87, 0.2) !important;
        border: 2px solid #ff4757 !important;
        backdrop-filter: brightness(0.7);
    }
    .mes.md-selected .md-click-catcher::after {
        content: '✓'; position: absolute; right: 10px; top: 10px;
        background: #ff4757; color: white; width: 22px; height: 22px;
        border-radius: 50%; display: flex; align-items: center; justify-content: center;
        font-weight: bold; font-size: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);
    }

    /* 底部面板：自适应主题颜色 */
    #multi-delete-panel {
        background-color: var(--SmartThemeBlurTintColor, rgba(20, 20, 20, 0.9)) !important;
        background-image: linear-gradient(var(--SmartThemeBgColor, #1a1a1a), var(--SmartThemeBgColor, #1a1a1a)) !important;
        border: 1px solid var(--SmartThemeBorderColor, #444) !important;
        color: var(--SmartThemeBodyColor, #eee) !important;
    }

    /* 预览弹窗：窗口化设计 */
    .md-modal-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.8);
        z-index: 2147483647; display: flex; align-items: flex-start; justify-content: center;
        backdrop-filter: blur(4px); padding: 20px; padding-top: 5vh; /* 避免顶出屏幕 */
    }
    .md-modal-box {
        background-color: var(--SmartThemeBgColor, #1a1a1a) !important;
        border: 1px solid var(--SmartThemeBorderColor, #444) !important;
        width: 100%; max-width: 700px; max-height: 85vh;
        border-radius: 12px; display: flex; flex-direction: column; 
        overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.8);
    }
    .md-modal-header { 
        background: rgba(0,0,0,0.2); padding: 15px 20px; 
        border-bottom: 1px solid var(--SmartThemeBorderColor, #444);
        flex-shrink: 0; color: var(--SmartThemeBodyColor);
    }
    .md-modal-body { flex: 1; overflow-y: auto; padding: 15px; min-height: 0; }
    .md-modal-footer { 
        padding: 15px 20px; border-top: 1px solid var(--SmartThemeBorderColor, #444);
        background: rgba(0,0,0,0.2); flex-shrink: 0;
    }

    /* 卡片式设计：自适应背景 */
    .md-nuke-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
    .md-nuke-card {
        background: rgba(255,255,255,0.03); border: 1px solid var(--SmartThemeBorderColor, #444);
        border-radius: 8px; padding: 12px; transition: 0.2s;
    }
    .md-nuke-card:hover { background: rgba(255,255,255,0.06); border-color: #ff4757; }
    
    /* 统一按钮样式，模仿酒馆样式 */
    .md-custom-btn {
        border: 1px solid var(--SmartThemeBorderColor, #555) !important;
        background: rgba(255,255,255,0.05) !important;
        color: var(--SmartThemeBodyColor, #eee) !important;
        border-radius: 5px; padding: 6px 12px; cursor: pointer; transition: 0.2s;
    }
    .md-custom-btn:hover { background: rgba(255,255,255,0.15) !important; }
    .md-custom-btn.primary { background: var(--SmartThemeQuoteColor, #6fa8dc) !important; color: white !important; border:none !important; }
    .md-custom-btn.danger { background: #ff4757 !important; color: white !important; border:none !important; }
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

// 控制面板：自适应UI
function showControlPanel() {
    if (!document.getElementById('multi-delete-panel')) {
        const bottomOffset = 'calc(20px + env(safe-area-inset-bottom, 0px))';
        const html = `
        <div id="multi-delete-panel" style="position: fixed; bottom: ${bottomOffset}; left: 10px; right: 10px; margin: 0 auto; max-width: 600px; z-index: 2147483647; padding: 12px; display: flex; flex-direction: column; gap: 10px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.8);">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                <span id="multi-delete-count" style="font-weight: bold; font-size: 14px;">已选 0 条</span>
                <div style="display: flex; align-items: center; gap: 5px;">
                    <input type="text" id="md-range-input" placeholder="如:0-12" style="width: 80px; background: rgba(0,0,0,0.3); border: 1px solid var(--SmartThemeBorderColor); color: white; border-radius: 4px; padding: 5px 8px; font-size: 13px; outline: none;">
                    <button id="md-btn-range" class="md-custom-btn primary">范围选中</button>
                </div>
            </div>
            <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 8px;">
                <button id="md-btn-all" class="md-custom-btn">全选</button>
                <button id="md-btn-inv" class="md-custom-btn">反选</button>
                <button id="md-btn-down" class="md-custom-btn">向下全选</button>
                <button id="multi-delete-exec-btn" class="md-custom-btn danger" style="font-weight: bold;"><i class="fa-solid fa-trash"></i> 删除</button>
                <button id="md-btn-cancel" class="md-custom-btn">取消</button>
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
            if (selectedIds.size === 0) return toastr.warning("请先手动点选一个起始楼层 o-o");
            const startId = Math.min(...Array.from(selectedIds));
            $('.mes[mesid]').each(function() {
                const id = parseInt($(this).attr('mesid'));
                if(!isNaN(id) && id >= startId) {
                    selectedIds.add(id);
                    updateBubbleVisuals(id);
                }
            });
            updatePanelCount();
            toastr.success(`已全选 #${startId} 之后的楼层 ovo`);
        });

        $('#md-btn-range').on('click', () => {
            const val = $('#md-range-input').val().trim();
            if (!val) return toastr.warning("例如: 0-12");
            let count = 0;
            val.split(',').forEach(p => {
                const r = p.trim().split('-');
                if (r.length === 1) { 
                    const i = parseInt(r[0]); if(!isNaN(i)) { selectedIds.add(i); updateBubbleVisuals(i); count++; }
                } else if (r.length === 2) { 
                    for (let i = Math.min(r[0], r[1]); i <= Math.max(r[0], r[1]); i++) {
                        selectedIds.add(i); updateBubbleVisuals(i); count++;
                    }
                }
            });
            updatePanelCount();
            if(count > 0) $('#md-range-input').val('');
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

// 预览弹窗：修复高度与显示问题
function showReviewModal() {
    if (selectedIds.size === 0) return toastr.warning("未选择消息 o^o");
    closeModal();
    
    let userCount = 0, charCount = 0, sysCount = 0;
    const sortedIds = Array.from(selectedIds).sort((a, b) => a - b);
    
    let cardsHtml = '';
    sortedIds.forEach(id => {
        const bubble = $(`.mes[mesid="${id}"]`);
        if (bubble.length === 0) return;
        const isUser = bubble.attr('is_user') === 'true';
        const isSystem = bubble.attr('is_system') === 'true';
        if (isUser) userCount++; else if (isSystem) sysCount++; else charCount++;
        
        let name = (bubble.attr('ch_name') || '').trim() || (isUser ? "You" : "Character");
        let textPreview = bubble.find('.mes_text').text().replace(/\n/g, ' ').trim().substring(0, 100) || "（空/图片）";
        
        cardsHtml += `
        <div class="md-nuke-card" id="md-card-${id}">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 5px;">
                <span style="font-weight: bold; color: var(--SmartThemeQuoteColor); font-size: 13px;">#${id} [${name}]</span>
                <button class="md-spare-btn" data-id="${id}" style="background: rgba(16, 172, 132, 0.2); color: #1dd1a1; border: 1px solid #10ac84; border-radius: 4px; padding: 2px 6px; font-size: 11px; cursor: pointer;">撤出</button>
            </div>
            <div style="font-size: 12px; color: var(--SmartThemeBodyColor); opacity: 0.8; margin-top: 5px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${textPreview}</div>
        </div>`;
    });

    const modalHtml = `
    <div id="md-review-modal" class="md-modal-overlay">
        <div class="md-modal-box">
            <div class="md-modal-header">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold;"><i class="fa-solid fa-trash-can-arrow-up"></i> 删除预览</span>
                    <span style="font-size:13px; opacity:0.7;" id="md-queue-total">共 ${selectedIds.size} 条</span>
                </div>
            </div>
            <div class="md-modal-body">
                <div style="display: flex; gap: 10px; font-size: 12px; opacity: 0.6; margin-bottom: 15px; flex-wrap: wrap;">
                    <span>用户: ${userCount}</span> <span>角色: ${charCount}</span> <span>系统: ${sysCount}</span>
                </div>
                <div class="md-nuke-grid">${cardsHtml}</div>
            </div>
            <div class="md-modal-footer">
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:10px;">
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:12px; opacity:0.8;">
                        <input type="checkbox" id="md-export-backup" style="cursor:pointer;"> 顺便下载TXT备份
                    </label>
                    <div style="display:flex; gap:10px;">
                        <button id="md-modal-cancel" class="md-custom-btn">返回</button>
                        <button id="md-modal-move" class="md-custom-btn primary" title="搬家到JSONL文件"><i class="fa-solid fa-truck-fast"></i> 搬家</button>
                        <button id="md-modal-confirm" class="md-custom-btn danger">确认删除</button>
                    </div>
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
        card.fadeOut(200, function() {
            $(this).remove();
            $('#md-queue-total').text(`共 ${selectedIds.size} 条`);
            if(selectedIds.size === 0) closeModal();
        });
    });
}

function closeModal() {
    $('#md-review-modal').remove();
}

function generateTXTBackup(idsToNuke) {
    try {
        let content = "=== Deleted Backup ===\n";
        idsToNuke.slice().reverse().forEach(id => {
            const msg = chat[id];
            if(msg) content += `[${msg.name}]: ${msg.mes}\n\n`;
        });
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); 
        a.download = `ST_Backup_${Date.now()}.txt`; a.click();
    } catch (e) {}
}

function generateChatFileForMove(idsToMove) {
    try {
        let jsonStr = "";
        idsToMove.slice().sort((a,b) => a-b).forEach(id => { if(chat[id]) jsonStr += JSON.stringify(chat[id]) + "\n"; });
        const blob = new Blob([jsonStr], { type: "application/json" });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); 
        a.download = `Move_${Date.now()}.jsonl`; a.click();
    } catch (e) {}
}

async function executeDelete(isMove = false) {
    if (selectedIds.size === 0) return closeModal();
    let finalIds = Array.from(selectedIds);
    isProcessing = true;
    
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
    toastr.success(`成功删除${successCount}条信息 ovo`);
    
    isProcessing = false;
    closeModal();
    toggleMode();
}

// 入口按钮
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
            console.log("批量删楼完美版启动 ovo");
        }
    }, 1000); 
});
