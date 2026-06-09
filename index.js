import { chat, deleteMessage } from '../../../../script.js';

const extensionName = 'ST-Multi-Deleter';
let isDeleteMode = false;
let isProcessing = false;
let selectedIds = new Set();
let lastClickedId = null;

// ================= 样式重构：仿备份助手的窗口化 UI =================
const styleHtml = `
<style>
    /* 聊天气泡选中特效 */
    .mes.md-selected { position: relative; }
    .md-click-catcher {
        position: absolute; inset: 0; z-index: 1000; cursor: pointer; border-radius: 10px;
    }
    .mes.md-selected .md-click-catcher {
        background: rgba(255, 71, 87, 0.2);
        border: 2px solid #ff4757;
        backdrop-filter: brightness(0.7);
    }
    .mes.md-selected .md-click-catcher::after {
        content: '✓'; position: absolute; right: 10px; top: 10px;
        background: #ff4757; color: white; width: 22px; height: 22px;
        border-radius: 50%; display: flex; align-items: center; justify-content: center;
        font-weight: bold; font-size: 12px;
    }

    /* 仿备份助手的窗口样式 */
    .md-mask { 
        position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); 
        z-index: 20000; display: flex; justify-content: center; align-items: center; 
        backdrop-filter: blur(4px); overflow: hidden; padding: 10px;
    }
    .md-win { 
        position: relative; width: 95vw; max-width: 600px; max-height: 85vh; 
        background: #1a1a1a; border: 1px solid #444; border-radius: 12px; 
        display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.8); overflow: hidden;
    }
    .md-head { 
        padding: 15px 20px; background: rgba(0,0,0,0.3); border-bottom: 1px solid #333; 
        display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; 
    }
    .md-head h3 { margin: 0; font-size: 1.1rem; color: white; display: flex; align-items: center; gap: 10px; }
    
    /* 内容区 */
    .md-content { padding: 15px; flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; background: rgba(0,0,0,0.1); }
    
    /* 网格卡片 */
    .md-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
    .md-card { 
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
        border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 5px;
    }
    .md-card-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #444; padding-bottom: 5px; }
    .md-card-id { font-weight: bold; color: #ff6b81; font-size: 12px; }
    .md-card-text { font-size: 13px; color: #ccc; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

    /* 底部操作区 */
    .md-foot { padding: 15px; border-top: 1px solid #333; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; }
    .md-btns { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
    .md-btn { 
        padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; 
        font-weight: bold; color: white; transition: 0.2s; display: flex; align-items: center; gap: 6px;
    }
    .md-btn:active { transform: scale(0.95); }
</style>`;
document.head.insertAdjacentHTML('beforeend', styleHtml);

// ================= 核心逻辑 =================
function toggleMode() {
    if (isProcessing) return;
    isDeleteMode = !isDeleteMode;
    const btn = document.getElementById('multi-delete-open-btn');
    
    if (isDeleteMode) {
        if(btn) btn.classList.add('success');
        selectedIds.clear();
        lastClickedId = null;
        injectClickCatchers();
        showMainWindow(); // 直接显示窗口
    } else {
        if(btn) btn.classList.remove('success');
        removeClickCatchers();
        const win = document.getElementById('md-main-window');
        if(win) win.remove();
        const preview = document.getElementById('md-review-modal');
        if(preview) preview.remove();
    }
}

function injectClickCatchers() {
    $('.mes').each(function() {
        const mesId = $(this).attr('mesid');
        if (mesId !== undefined && $(this).find('.md-click-catcher').length === 0) {
            const catcher = $(`<div class="md-click-catcher" data-mesid="${mesId}"></div>`);
            catcher.on('click', function(e) {
                e.stopPropagation(); 
                const id = parseInt(mesId);
                if (selectedIds.has(id)) selectedIds.delete(id);
                else selectedIds.add(id);
                const bubble = $(`.mes[mesid="${id}"]`);
                if (selectedIds.has(id)) bubble.addClass('md-selected');
                else bubble.removeClass('md-selected');
                updateWinCount();
            });
            $(this).append(catcher);
        }
    });
}

function removeClickCatchers() {
    $('.md-click-catcher').remove();
    $('.mes').removeClass('md-selected');
}

function updateWinCount() {
    const el = document.getElementById('md-win-count');
    if(el) el.innerText = `已选 ${selectedIds.size} 条`;
}

// ================= 核心界面：独立主窗口 =================
function showMainWindow() {
    const exist = document.getElementById('md-main-window');
    if(exist) return;

    const html = `
    <div id="md-main-window" class="md-mask">
        <div class="md-win">
            <div class="md-head">
                <h3><i class="fa-solid fa-list-check"></i> 批量删除信息</h3>
                <div style="cursor:pointer; font-size:20px; color:#999;" onclick="window.multiDeleter.toggleMode()">×</div>
            </div>
            
            <div class="md-content">
                <div style="background: rgba(255,165,0,0.1); border: 1px solid rgba(255,165,0,0.3); color: #ffb347; padding: 10px; border-radius: 8px; font-size: 13px; margin-bottom: 10px;">
                    💡 <b>手机端操作说明 ovo</b>：<br>
                    直接在聊天背景里点击气泡即可选中。<br>
                    也可在下方输入范围快速选中。
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 15px;">
                    <input type="text" id="md-range-input" placeholder="输入范围如: 0-12" style="flex: 1; background: #000; border: 1px solid #555; color: white; border-radius: 4px; padding: 8px; font-size: 14px; outline: none;">
                    <button class="md-btn" style="background: #8e44ad;" onclick="window.multiDeleter.selectRange()">范围选中</button>
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    <button class="md-btn" style="background: #3498db; font-size: 12px;" onclick="window.multiDeleter.selectAll()">全部选中</button>
                    <button class="md-btn" style="background: #e67e22; font-size: 12px;" onclick="window.multiDeleter.selectDown()">向下全选</button>
                </div>
            </div>

            <div class="md-foot">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span id="md-win-count" style="font-weight: bold; color: white;">已选 0 条</span>
                    <button class="md-btn" style="background: #ff4757; font-size: 15px; padding: 10px 20px;" onclick="window.multiDeleter.openReview()">
                        <i class="fa-solid fa-trash"></i> 确认删除
                    </button>
                </div>
            </div>
        </div>
    </div>`;
    
    $('body').append(html);
}

// 绑定全局方法方便 HTML 调用
window.multiDeleter = {
    toggleMode,
    selectRange() {
        const val = $('#md-range-input').val().trim();
        if (!val) return;
        val.split(',').forEach(part => {
            const range = part.trim().split('-');
            if (range.length === 1) { 
                const id = parseInt(range[0]);
                if (!isNaN(id)) { selectedIds.add(id); $(`.mes[mesid="${id}"]`).addClass('md-selected'); }
            } else if (range.length === 2) { 
                for (let i = Math.min(range[0], range[1]); i <= Math.max(range[0], range[1]); i++) {
                    selectedIds.add(i); $(`.mes[mesid="${i}"]`).addClass('md-selected');
                }
            }
        });
        updateWinCount();
        $('#md-range-input').val('');
    },
    selectAll() {
        $('.mes[mesid]').each(function() {
            const id = parseInt($(this).attr('mesid'));
            selectedIds.add(id); $(this).addClass('md-selected');
        });
        updateWinCount();
    },
    selectDown() {
        if (selectedIds.size === 0) return toastr.warning("请先手动选一个起始层");
        const startId = Math.min(...Array.from(selectedIds));
        $('.mes[mesid]').each(function() {
            const id = parseInt($(this).attr('mesid'));
            if(id >= startId) { selectedIds.add(id); $(this).addClass('md-selected'); }
        });
        updateWinCount();
    },
    openReview: showReviewModal
};

// ================= 独创防呆弹窗 (卡片模式) =================
function showReviewModal() {
    if (selectedIds.size === 0) return toastr.warning("还没选消息 ovo");
    
    // 隐藏主选择窗
    const mainWin = document.getElementById('md-main-window');
    if(mainWin) mainWin.style.display = 'none';

    let cardsHtml = '';
    Array.from(selectedIds).sort((a, b) => a - b).forEach(id => {
        const bubble = $(`.mes[mesid="${id}"]`);
        if (bubble.length === 0) return;
        const name = (bubble.attr('ch_name') || '').trim() || (bubble.attr('is_user') === 'true' ? "User" : "Char");
        const text = bubble.find('.mes_text').text().replace(/\n/g, ' ').trim().substring(0, 100);
        
        cardsHtml += `
        <div class="md-card" id="md-card-${id}">
            <div class="md-card-head">
                <span class="md-card-id">#${id} - ${name}</span>
                <button style="background:#10ac84; color:white; border:none; border-radius:4px; padding:2px 6px; font-size:11px;" onclick="window.multiDeleter.spare(${id})">撤出</button>
            </div>
            <div class="md-card-text">${text || '图片/空'}</div>
        </div>`;
    });

    const modalHtml = `
    <div id="md-review-modal" class="md-mask">
        <div class="md-win">
            <div class="md-head">
                <h3><i class="fa-solid fa-clipboard-check"></i> 确认删除队列</h3>
                <span style="color:#999; font-size:14px;">共 ${selectedIds.size} 条</span>
            </div>
            <div class="md-content">
                <div class="md-grid">${cardsHtml}</div>
            </div>
            <div class="md-foot">
                <label style="color:#f39c12; font-size:13px; display:flex; align-items:center; gap:5px;">
                    <input type="checkbox" id="md-backup-check"> 下载TXT备份
                </label>
                <div class="md-btns">
                    <button class="md-btn" style="background:#747d8c;" onclick="window.multiDeleter.backToSelect()">返回</button>
                    <button class="md-btn" style="background:#8e44ad;" onclick="window.multiDeleter.exec(true)">搬家</button>
                    <button class="md-btn" style="background:#ff4757;" onclick="window.multiDeleter.exec(false)">确认删除</button>
                </div>
            </div>
        </div>
    </div>`;
    $('body').append(modalHtml);
}

// 补充全域方法
window.multiDeleter.spare = function(id) {
    selectedIds.delete(id);
    $(`.mes[mesid="${id}"]`).removeClass('md-selected');
    $(`#md-card-${id}`).fadeOut(200, function() { $(this).remove(); });
    if(selectedIds.size === 0) window.multiDeleter.backToSelect();
};
window.multiDeleter.backToSelect = function() {
    $('#md-review-modal').remove();
    const mainWin = document.getElementById('md-main-window');
    if(mainWin) {
        mainWin.style.display = 'flex';
        updateWinCount();
    }
};
window.multiDeleter.exec = async function(isMove) {
    isProcessing = true;
    const finalIds = Array.from(selectedIds).sort((a, b) => b - a);
    
    // 备份逻辑
    if(document.getElementById('md-backup-check').checked) {
        let content = "Backup:\n";
        finalIds.slice().reverse().forEach(id => {
            const m = chat[id];
            content += `${m.name}: ${m.mes}\n\n`;
        });
        const blob = new Blob([content], {type:"text/plain"});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "backup.txt"; a.click();
    }
    
    // 搬家逻辑 (JSONL)
    if(isMove) {
        let jsonl = "";
        finalIds.slice().reverse().forEach(id => { jsonl += JSON.stringify(chat[id]) + "\n"; });
        const blob = new Blob([jsonl], {type:"application/json"});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "move.jsonl"; a.click();
    }

    // 执行删除
    for (const id of finalIds) { await deleteMessage(id); }
    toastr.success(`成功操作 ${finalIds.length} 条信息 ovo`);
    
    isProcessing = false;
    toggleMode(); // 全部关闭
};

// 注入入口按钮
jQuery(() => {
    const itv = setInterval(() => {
        const menu = document.getElementById('extensionsMenu');
        if (menu && !document.getElementById('multi-delete-open-btn')) {
            const btn = document.createElement('div');
            btn.id = 'multi-delete-open-btn';
            btn.className = 'list-group-item flex-container flex-gap-10 interactable';
            btn.innerHTML = '<div class="fa-solid fa-list-check"></div><div>批量删除信息</div>';
            btn.onclick = toggleMode;
            menu.appendChild(btn);
            clearInterval(itv);
        }
    }, 1000);
});
