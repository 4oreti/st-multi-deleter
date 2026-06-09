import { chat, deleteMessage } from '../../../../script.js';

const extensionName = 'ST-Multi-Deleter';
let isDeleteMode = false;
let isProcessing = false;
let selectedIds = new Set();
let lastClickedId = null;

// ================= CSS 样式 =================
const styleHtml = `
<style>
    /* 拦截遮罩与气泡选中特效 */
    .md-click-catcher { position: absolute; inset: 0; z-index: 1000; cursor: pointer; border-radius: 10px; transition: all 0.2s; }
    .mes.md-selected .md-click-catcher { background: rgba(255, 71, 87, 0.15); border: 2px solid #ff4757; backdrop-filter: brightness(0.7); }
    .mes.md-selected .md-click-catcher::after {
        content: '✓'; position: absolute; right: 15px; top: 15px; background: #ff4757; color: white; 
        width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
        font-weight: bold; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);
    }
    
    /* 防呆预览弹窗的居中遮罩 */
    .md-mask { 
        position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 30000; 
        display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 15px;
    }
    .md-win { 
        width: 100%; max-width: 650px; height: 85vh; background: #1a1a1a; 
        border-radius: 12px; border: 1px solid #444; display: flex; flex-direction: column; 
        overflow: hidden; box-shadow: 0 15px 50px rgba(0,0,0,0.8);
    }
    
    /* 卡片网格 */
    .md-nuke-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
    .md-nuke-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
    .md-nuke-card:hover { border-color: rgba(255, 71, 87, 0.5); background: rgba(255, 71, 87, 0.1); }
</style>`;
document.head.insertAdjacentHTML('beforeend', styleHtml);

// ================= 全局方法绑定 (方便HTML调用) =================
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
            showControlPanel(); // ★ 注入到聊天框上方
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
        const card = $(`#md-card-${id}`);
        card.css({ transform: 'scale(0.8)', opacity: 0 });
        setTimeout(() => {
            card.remove(); 
            $('#md-queue-total').text(`共 ${selectedIds.size} 条`);
            if(selectedIds.size === 0) { closeModal(); toastr.info("队列已清空 ovo"); }
        }, 200);
    },
    execMove() { executeDelete(true); },
    execDelete() { executeDelete(false); }
};

// ================= 气泡操作 =================
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

// ================= ★ 完美兼容：注入到底部输入框上方 =================
function showControlPanel() {
    if (document.getElementById('md-action-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'md-action-bar';
    // 融入酒馆原生底部的样式
    bar.style.cssText = "display: flex; flex-direction: column; gap: 8px; padding: 12px; background: rgba(0,0,0,0.3); border-top: 1px solid rgba(255,255,255,0.1); border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 5px;";
    
    bar.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span id="md-win-count" style="font-weight: bold; color: #ff6b81; font-size: 14px;">已选 0 条</span>
            <div style="display: flex; align-items: center; gap: 5px;">
                <input type="text" id="md-range-input" placeholder="如:0-12" style="width: 80px; background: rgba(0,0,0,0.5); border: 1px solid #777; color: white; border-radius: 4px; padding: 5px; font-size: 12px; outline: none;">
                <button style="background: #8e44ad; color: white; border: none; border-radius: 4px; padding: 5px 10px; font-size: 12px; cursor:pointer;" onclick="window.multiDeleter.selectRange()">范围</button>
            </div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            <button style="background: #3498db; color: white; border: none; border-radius: 4px; padding: 6px 12px; font-size: 12px; cursor:pointer;" onclick="window.multiDeleter.selectAll()">全选</button>
            <button style="background: #e67e22; color: white; border: none; border-radius: 4px; padding: 6px 12px; font-size: 12px; cursor:pointer;" onclick="window.multiDeleter.selectDown()">向下</button>
            <button style="background: #ff4757; color: white; border: none; border-radius: 4px; padding: 6px 12px; font-size: 12px; font-weight: bold; cursor:pointer;" onclick="window.multiDeleter.openReview()">预览与处理</button>
            <button style="background: #747d8c; color: white; border: none; border-radius: 4px; padding: 6px 12px; font-size: 12px; cursor:pointer;" onclick="window.multiDeleter.toggleMode()">取消</button>
        </div>
    `;

    // 寻找酒馆原生输入框的容器，把我们的面板安插在发送框的正上方
    const formSheld = document.getElementById('form_sheld');
    const sendForm = document.getElementById('send_form');
    
    if (formSheld && sendForm) {
        formSheld.insertBefore(bar, sendForm);
    } else {
        // 如果找不到，才启用后备的悬浮模式
        bar.style.position = 'fixed';
        bar.style.bottom = '80px';
        bar.style.left = '10px';
        bar.style.right = '10px';
        bar.style.zIndex = '20000';
        bar.style.borderRadius = '10px';
        document.body.appendChild(bar);
    }
}

function hideControlPanel() {
    const bar = document.getElementById('md-action-bar');
    if(bar) bar.remove();
}

// ================= ★ 弹窗防呆预览 (修复绝对居中与读取DOM) =================
function showReviewModal() {
    if (selectedIds.size === 0) return toastr.warning("未选择任何消息 o^o", "提示");
    closeModal();
    
    let userCount = 0, charCount = 0, sysCount = 0;
    
    let cardsHtml = '';
    Array.from(selectedIds).sort((a, b) => a - b).forEach(id => {
        // 直接读取屏幕上真实的气泡，确保“所见即所得”，连玩家消息也不会漏！
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
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.2); padding-bottom: 5px;">
                <span style="font-weight: bold; color: #ff6b81; font-size: 12px;">#${id} [${typeLabel}] ${name}</span>
                <button style="background: #10ac84; color: white; border: none; border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer;" onclick="window.multiDeleter.spare(${id})">
                    撤出
                </button>
            </div>
            <div style="font-size: 13px; color: #ccc; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${textPreview}</div>
        </div>`;
    });

    const modalHtml = `
    <div id="md-review-modal" class="md-mask">
        <div class="md-win">
            <!-- 头部 -->
            <div style="flex-shrink:0; padding:15px 20px; background:rgba(0,0,0,0.3); border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:16px; color:white;"><i class="fa-solid fa-clipboard-check"></i> 处理队列确认</h3>
                <span style="font-size:13px; color:#ff6b81;" id="md-queue-total">共 ${selectedIds.size} 条</span>
            </div>
            
            <!-- 内容滚动区 (采用 flex:1 保证不越界) -->
            <div style="flex:1; overflow-y:auto; padding:15px; background:rgba(0,0,0,0.1);">
                <div style="display:flex; gap:15px; font-size:13px; color:#aaa; margin-bottom:15px; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; flex-wrap:wrap;">
                    <div>包含：用户 <span style="color:#fff;font-weight:bold;">${userCount}</span> 条</div>
                    <div>角色 <span style="color:#fff;font-weight:bold;">${charCount}</span> 条</div>
                    <div>系统 <span style="color:#fff;font-weight:bold;">${sysCount}</span> 条</div>
                </div>
                <div class="md-nuke-grid">${cardsHtml}</div>
            </div>
            
            <!-- 底部操作区 -->
            <div style="flex-shrink:0; padding:15px 20px; border-top:1px solid #333; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <label style="color:#f39c12; font-size:13px; display:flex; align-items:center; gap:5px; cursor:pointer;">
                    <input type="checkbox" id="md-export-backup" style="cursor:pointer;"> 下载TXT备份
                </label>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button style="background:#747d8c; color:white; border:none; border-radius:5px; padding:6px 12px; font-size:13px; cursor:pointer;" onclick="window.multiDeleter.closeReview()">返回</button>
                    <button style="background:#8e44ad; color:white; border:none; border-radius:5px; padding:6px 12px; font-size:13px; font-weight:bold; cursor:pointer;" onclick="window.multiDeleter.execMove()">
                        <i class="fa-solid fa-truck-fast"></i> 搬家
                    </button>
                    <button id="md-btn-final-del" style="background:#ff4757; color:white; border:none; border-radius:5px; padding:6px 12px; font-size:13px; font-weight:bold; cursor:pointer;" onclick="window.multiDeleter.execDelete()">确认删除</button>
                </div>
            </div>
        </div>
    </div>`;
    
    $('body').append(modalHtml);
}

window.multiDeleter.closeReview = closeModal;

function closeModal() {
    $('#md-review-modal').remove();
}

// ================= 导出与处理 =================
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
            console.log(`${extensionName} 完美嵌入版加载完成 ovo`);
        }
    }, 1000); 
});
