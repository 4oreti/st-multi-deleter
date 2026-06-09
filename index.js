import { chat, deleteMessage } from '../../../../script.js';

const extensionName = 'ST-Multi-Deleter';
let isDeleteMode = false;
let isProcessing = false;
let selectedIds = new Set();
let lastClickedId = null;

// ================= CSS 样式配置 =================
const styleHtml = `
<style>
    /* 拦截遮罩与选中态 */
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
    
    /* 弹窗基础样式 */
    .md-modal-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.75); backdrop-filter: blur(5px);
        z-index: 999999; display: flex; align-items: center; justify-content: center;
    }
    .md-modal-box {
        background: var(--SmartThemeBlurTintColor, #222); width: 95%; max-width: 700px;
        max-height: 85vh; border-radius: 15px; border: 1px solid var(--SmartThemeBorderColor, #555);
        display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.6);
    }
    .md-modal-header { padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: bold; font-size: 18px; display:flex; justify-content: space-between; align-items: center;}
    .md-modal-body { padding: 15px; overflow-y: auto; flex: 1; background: rgba(0,0,0,0.2); }
    .md-modal-footer { padding: 15px 20px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap:10px;}
    
    /* ★ 独创设计：卡片式网格布局 */
    .md-nuke-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 12px;
    }
    .md-nuke-card {
        background: rgba(255, 71, 87, 0.08); border: 1px solid rgba(255, 71, 87, 0.3);
        border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s;
    }
    .md-nuke-card:hover { border-color: rgba(255, 71, 87, 0.8); background: rgba(255, 71, 87, 0.15); }
    .md-nuke-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.2); padding-bottom: 6px; }
    .md-nuke-id { font-weight: bold; color: #ff6b81; font-size: 13px; }
    .md-nuke-name { font-size: 12px; color: #ccc; flex: 1; margin-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    
    /* 豁免按钮 */
    .md-spare-btn {
        background: #10ac84; color: white; border: none; border-radius: 4px; padding: 4px 8px;
        font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;
    }
    .md-spare-btn:hover { background: #1dd1a1; transform: scale(1.05); }
    
    .md-nuke-text { font-size: 13px; color: #ddd; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    
    /* 统计条 */
    .md-stats-bar { display: flex; gap: 15px; font-size: 13px; color: #aaa; margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; }
    .md-stats-bar span { color: #fff; font-weight: bold; }
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

// 底部控制面板
function showControlPanel() {
    if (!document.getElementById('multi-delete-panel')) {
        const html = `
        <div id="multi-delete-panel" style="position: fixed; bottom: 70px; left: 50%; transform: translateX(-50%); background: var(--SmartThemeBlurTintColor, rgba(0,0,0,0.9)); backdrop-filter: blur(10px); padding: 12px 15px; border-radius: 12px; z-index: 99998; border: 1px solid var(--SmartThemeBorderColor, #555); box-shadow: 0 4px 15px rgba(0,0,0,0.5); display: flex; flex-direction: column; gap: 10px; min-width: 320px; max-width: 95vw;">
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
            if (selectedIds.size === 0) return toastr.warning("请先点击选择一个起始楼层。");
            const startId = Math.min(...Array.from(selectedIds));
            $('.mes[mesid]').each(function() {
                const id = parseInt($(this).attr('mesid'));
                if(!isNaN(id) && id >= startId) {
                    selectedIds.add(id);
                    updateBubbleVisuals(id);
                }
            });
            updatePanelCount();
            toastr.success(`已向下全选 #${startId} 之后的所有楼层！`);
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
            if (addedCount > 0) { toastr.success("选中成功！"); $('#md-range-input').val(''); } 
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

// ================= 独创防呆弹窗 (卡片队列) =================
function showReviewModal() {
    if (selectedIds.size === 0) return toastr.warning("未选择任何消息！", "提示");
    closeModal();
    
    let userCount = 0, charCount = 0, sysCount = 0;
    const sortedIds = Array.from(selectedIds).sort((a, b) => a - b);
    
    let cardsHtml = '';
    sortedIds.forEach(id => {
        const msg = chat[id];
        if(!msg) return;
        
        let typeLabel = "角色";
        if(msg.is_user) { userCount++; typeLabel = "用户"; }
        else if(msg.is_system) { sysCount++; typeLabel = "系统"; }
        else { charCount++; }
        
        const name = msg.name || (msg.is_user ? "You" : "Character");
        let textPreview = msg.mes ? msg.mes.replace(/\n/g, ' ').substring(0, 150) : "（空消息/图片）";
        
        // 生成独立卡片
        cardsHtml += `
        <div class="md-nuke-card" id="md-card-${id}">
            <div class="md-nuke-header">
                <div style="display:flex; align-items:center;">
                    <span class="md-nuke-id">#${id}</span>
                    <span class="md-nuke-name">[${typeLabel}] ${name}</span>
                </div>
                <!-- 核心防呆：移出队列按钮 -->
                <button class="md-spare-btn" data-id="${id}" title="保留这条消息">
                    <i class="fa-solid fa-rotate-left"></i> 撤出
                </button>
            </div>
            <div class="md-nuke-text">${textPreview}</div>
        </div>`;
    });

    const modalHtml = `
    <div id="md-review-modal" class="md-modal-overlay">
        <div class="md-modal-box">
            <div class="md-modal-header">
                <span><i class="fa-solid fa-trash-can-arrow-up"></i> 处理队列确认</span>
                <span style="font-size:14px; font-weight:normal; color:#ff6b81;" id="md-queue-total">共 ${selectedIds.size} 条</span>
            </div>
            <div class="md-modal-body">
                <div class="md-stats-bar">
                    <div>包含：用户发言 <span id="md-stat-user">${userCount}</span> 条</div>
                    <div>角色发言 <span id="md-stat-char">${charCount}</span> 条</div>
                    <div>系统提示 <span id="md-stat-sys">${sysCount}</span> 条</div>
                </div>
                <!-- 卡片网格 -->
                <div class="md-nuke-grid">${cardsHtml}</div>
            </div>
            <div class="md-modal-footer">
                <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:13px; color:#f39c12;">
                    <!-- 默认不勾选 -->
                    <input type="checkbox" id="md-export-backup" style="accent-color:#f39c12; width:16px; height:16px;"> 
                    <i class="fa-solid fa-file-export"></i> 删除前下载TXT备份
                </label>
                <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content: flex-end;">
                    <button id="md-modal-cancel" class="menu_button interactable" style="background: #747d8c; padding: 6px 12px;">返回</button>
                    <!-- 搬家 -->
                    <button id="md-modal-move" class="menu_button interactable" style="background: #8e44ad; color: white; border: none; border-radius: 5px; padding: 6px 12px; font-weight:bold;" title="打包成.jsonl文件并移除">
                        <i class="fa-solid fa-truck-fast"></i> 搬家
                    </button>
                    <!-- 最终删除 -->
                    <button id="md-modal-confirm" class="menu_button interactable" style="background: #ff4757; font-weight:bold; padding: 6px 12px;">确认删除</button>
                </div>
            </div>
        </div>
    </div>`;
    
    $('body').append(modalHtml);
    
    // 绑定弹窗内事件
    $('#md-modal-cancel').on('click', closeModal);
    $('#md-modal-confirm').on('click', () => executeDelete(false));
    $('#md-modal-move').on('click', () => executeDelete(true));
    
    // ★ 撤出队列(豁免)逻辑的动态绑定
    $('#md-review-modal').on('click', '.md-spare-btn', function() {
        const id = parseInt($(this).data('id'));
        
        // 1. 从选择池中移除并恢复背景聊天气泡
        selectedIds.delete(id);
        updateBubbleVisuals(id);
        updatePanelCount();
        
        // 2. 炫酷的卡片飞出动画
        const card = $(`#md-card-${id}`);
        card.css({ transform: 'scale(0.8)', opacity: 0 });
        
        setTimeout(() => {
            card.remove(); // 从DOM移除
            // 更新顶部数字
            $('#md-queue-total').text(`共 ${selectedIds.size} 条`);
            
            // 如果全撤出了，自动关闭弹窗
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

// 导出与操作 (保持上一个版本的精髓)
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
    // 独家优化：既然卡片操作已经实时更新了 selectedIds，这里不再需要去遍历DOM读勾选框了！
    if (selectedIds.size === 0) return closeModal();
    let finalIds = Array.from(selectedIds);

    isProcessing = true;
    if (isMove) {
        $('#md-modal-move').html('<i class="fa-solid fa-spinner fa-spin"></i> 打包中...').css('pointer-events', 'none');
        generateChatFileForMove(finalIds);
    } else {
        $('#md-modal-confirm').html('<i class="fa-solid fa-spinner fa-spin"></i> 处理中...').css('pointer-events', 'none');
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
        if (isMove) toastr.success(`成功搬走 ${successCount} 条信息！请使用酒馆的【导入聊天】功能。`, "搬家完成", {timeOut: 8000});
        else toastr.success(`成功删除${successCount}条信息`); // 满足文案要求5
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
            btn.innerHTML = '<div class="fa-solid fa-list-check"></div><div>批量删除信息</div>'; // 满足文案要求1
            btn.addEventListener('click', toggleMode);
            bar.appendChild(btn);
            clearInterval(checkBtn);
            console.log(`${extensionName} 卡片队列版加载完成！`);
        }
    }, 1000); 
});
