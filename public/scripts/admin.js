/**
 * 后台管理共享 JS 工具库
 * 提供：API 请求、表格渲染、弹窗、Toast、确认框、分页、表单工具
 * 依赖：admin.css
 * 使用：在页面 <script> 中引入本文件，调用 window.Admin.* 方法
 */
(function () {
  'use strict';

  // ===== Token 管理 =====
  function getToken() {
    try { return localStorage.getItem('token') || ''; } catch (e) { return ''; }
  }
  function isLoggedIn() { return !!getToken(); }

  // ===== API 请求 =====
  // 统一通过同源路径请求（middleware 代理到后端）
  // 返回 Promise<data>，失败抛 Error（含 message）
  function request(path, options) {
    var opts = options || {};
    var method = (opts.method || 'GET').toUpperCase();
    var token = getToken();
    var headers = opts.headers || {};
    if (token) headers['Authorization'] = token;
    var body = opts.body;
    if (body && !(body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    var url = path;
    // GET 请求拼接 query params
    if (opts.params && method === 'GET') {
      var qs = new URLSearchParams();
      Object.keys(opts.params).forEach(function (k) {
        var v = opts.params[k];
        if (v !== undefined && v !== null && v !== '') qs.append(k, v);
      });
      var qsStr = qs.toString();
      if (qsStr) url += (url.includes('?') ? '&' : '?') + qsStr;
    }
    return fetch(url, {
      method: method,
      headers: headers,
      body: body,
      credentials: 'include',
      referrerPolicy: 'no-referrer-when-downgrade',
    }).then(function (r) {
      // 非 JSON 响应（如文件下载）
      var ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      }
      return r.json().then(function (d) {
        // 401 未登录
        if (d && d.code === 401) {
          try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('userRoles');
          } catch (e) {}
          if (location.pathname !== '/login') {
            location.href = '/login?redirect=' + encodeURIComponent(location.pathname + location.search);
          }
          throw new Error('未登录或登录已过期');
        }
        // 业务失败
        if (d && d.code !== undefined && d.code !== 200 && d.code !== 0) {
          var err = new Error(d.message || '请求失败');
          err.code = d.code;
          err.data = d.data;
          throw err;
        }
        // 成功返回 data
        return (d && d.data !== undefined) ? d.data : d;
      });
    });
  }

  var api = {
    get: function (url, params) { return request(url, { method: 'GET', params: params }); },
    post: function (url, body) { return request(url, { method: 'POST', body: body }); },
    put: function (url, body) { return request(url, { method: 'PUT', body: body }); },
    del: function (url) { return request(url, { method: 'DELETE' }); },
  };

  // ===== 工具函数 =====
  function esc(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDate(d, withTime) {
    if (!d) return '-';
    var date;
    if (d instanceof Date) {
      date = d;
    } else if (typeof d === 'number') {
      date = new Date(d);
    } else {
      // 兼容 "2024-01-01 12:00:00" / ISO 字符串
      date = new Date(String(d).replace(/-/g, '/'));
    }
    if (isNaN(date.getTime())) return String(d);
    var Y = date.getFullYear();
    var M = String(date.getMonth() + 1).padStart(2, '0');
    var D = String(date.getDate()).padStart(2, '0');
    var str = Y + '-' + M + '-' + D;
    if (withTime) {
      var h = String(date.getHours()).padStart(2, '0');
      var m = String(date.getMinutes()).padStart(2, '0');
      str += ' ' + h + ':' + m;
    }
    return str;
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait || 300);
    };
  }

  // 获取分页数据（兼容 records/list/rows 数组格式，兼容 total/totalCount 字段）
  function getPageRecords(data) {
    if (Array.isArray(data)) return { list: data, total: data.length };
    if (!data) return { list: [], total: 0 };
    var list = data.records || data.list || data.rows || [];
    // 注意：不能用 ||，否则 total=0 会被当作 falsy 跳过
    var total = data.total != null ? data.total : (data.totalCount != null ? data.totalCount : list.length);
    return { list: list, total: total };
  }

  // ===== Toast 提示 =====
  var toastContainer = null;
  function ensureToastContainer() {
    if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.className = 'admin-toast-container';
    document.body.appendChild(toastContainer);
    return toastContainer;
  }

  function toast(msg, type, duration) {
    var container = ensureToastContainer();
    var el = document.createElement('div');
    el.className = 'admin-toast admin-toast-' + (type || 'info');
    var iconMap = {
      success: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      error: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };
    el.innerHTML = (iconMap[type] || iconMap.info) + '<span>' + esc(msg) + '</span>';
    container.appendChild(el);
    setTimeout(function () {
      el.style.animation = 'admin-toast-in 0.3s ease reverse';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, duration || 2500);
  }

  // ===== 确认弹窗 =====
  function confirmDialog(message, onConfirm, opts) {
    if (window.__showConfirm) {
      window.__showConfirm(message, onConfirm, opts);
    } else if (window.confirm(message)) {
      onConfirm && onConfirm();
    }
  }

  // ===== Modal 弹窗 =====
  // options: { title, body(html), width, onOpen, onClose, footer(html) }
  function openModal(options) {
    closeModal(); // 先关闭已有弹窗
    var overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay show';
    overlay.id = 'admin-modal-active';
    var modal = document.createElement('div');
    modal.className = 'admin-modal';
    if (options.width) modal.style.maxWidth = options.width;

    var headerHtml = '<div class="admin-modal-header">' +
      '<h3>' + esc(options.title || '') + '</h3>' +
      '<button type="button" class="admin-modal-close" data-modal-close>&times;</button>' +
      '</div>';
    var bodyHtml = '<div class="admin-modal-body">' + (options.body || '') + '</div>';
    var footerHtml = options.footer !== undefined ?
      '<div class="admin-modal-footer">' + options.footer + '</div>' : '';
    modal.innerHTML = headerHtml + bodyHtml + footerHtml;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 点击遮罩或关闭按钮
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.hasAttribute('data-modal-close')) {
        closeModal();
        if (options.onClose) options.onClose();
      }
    });
    // ESC 关闭
    var escHandler = function (e) {
      if (e.key === 'Escape') {
        closeModal();
        if (options.onClose) options.onClose();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    if (options.onOpen) options.onOpen(modal);
    return modal;
  }

  function closeModal() {
    var existing = document.getElementById('admin-modal-active');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
  }

  // ===== 表单工具 =====
  // 从表单元素收集数据（name 属性）
  function serializeForm(form) {
    var data = {};
    var elements = form.querySelectorAll('input, select, textarea');
    elements.forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        data[el.name] = el.checked ? 1 : 0;
      } else if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else {
        var val = el.value;
        // 数字转换
        if (el.dataset.type === 'number' && val !== '') {
          data[el.name] = Number(val);
        } else {
          data[el.name] = val;
        }
      }
    });
    return data;
  }

  // 回填表单数据
  function fillForm(form, data) {
    if (!data) return;
    var elements = form.querySelectorAll('input, select, textarea');
    elements.forEach(function (el) {
      if (!el.name || !(el.name in data)) return;
      var val = data[el.name];
      if (el.type === 'checkbox') {
        el.checked = val == 1 || val === true;
      } else if (el.type === 'radio') {
        el.checked = String(el.value) === String(val);
      } else {
        el.value = val === undefined || val === null ? '' : val;
      }
    });
  }

  function resetForm(form) {
    if (form.reset) form.reset();
  }

  // ===== 分页组件 =====
  // container: 分页容器 DOM
  // options: { current, pageSize, total, pageSizes, onChange(pageNum, pageSize) }
  function renderPagination(container, options) {
    if (!container) return;
    // 确保容器有 admin-pagination 类（控制横向 flex 布局）
    if (container.className.indexOf('admin-pagination') === -1) {
      container.className = (container.className + ' admin-pagination').trim();
    }
    var current = options.current || 1;
    var pageSize = options.pageSize || 10;
    var total = options.total || 0;
    var pageSizes = options.pageSizes || [10, 20, 30, 50];
    var totalPages = Math.ceil(total / pageSize) || 1;
    // 防止 current 超出范围
    if (current > totalPages) current = totalPages;
    if (current < 1) current = 1;

    // 分页信息：显示当前条目范围 + 总数
    var startItem = total > 0 ? (current - 1) * pageSize + 1 : 0;
    var endItem = Math.min(current * pageSize, total);
    // 左区：信息 + 每页条数
    var html = '<div class="admin-pagination-left">';
    html += '<span class="admin-pagination-info">第 ' + startItem + '-' + endItem + ' 条 / 共 ' + total + ' 条</span>';
    html += '<select class="admin-page-size" id="page-size-select">';
    pageSizes.forEach(function (ps) {
      html += '<option value="' + ps + '"' + (ps === pageSize ? ' selected' : '') + '>' + ps + ' 条/页</option>';
    });
    html += '</select>';
    html += '</div>';

    // 右区：页码 + 跳转（合并为整体容器，换行时整体换行更优雅）
    html += '<div class="admin-pagination-right">';
    html += '<div class="admin-pager">';
    // 上一页
    html += '<button class="admin-page-btn" data-page="' + (current > 1 ? current - 1 : 1) + '"' + (current <= 1 ? ' disabled' : '') + '>&lsaquo;</button>';

    // 页码按钮
    var maxVisible = 10; // 总页数不超过10时全部显示，超过10才使用省略号
    if (totalPages <= maxVisible) {
      for (var i = 1; i <= totalPages; i++) {
        html += '<button class="admin-page-btn' + (i === current ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
      }
    } else {
      // 总页数超过10，智能省略：当前页左右各显示2页 + 首尾页
      var half = 2;
      var start = Math.max(1, current - half);
      var end = Math.min(totalPages, current + half);
      if (start === 1) end = Math.min(totalPages, start + maxVisible - 3);
      if (end === totalPages) start = Math.max(1, end - maxVisible + 3);
      if (start > 1) {
        html += '<button class="admin-page-btn" data-page="1">1</button>';
        if (start > 2) html += '<span class="admin-page-ellipsis">...</span>';
      }
      for (var i = start; i <= end; i++) {
        html += '<button class="admin-page-btn' + (i === current ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
      }
      if (end < totalPages) {
        if (end < totalPages - 1) html += '<span class="admin-page-ellipsis">...</span>';
        html += '<button class="admin-page-btn" data-page="' + totalPages + '">' + totalPages + '</button>';
      }
    }

    // 下一页
    html += '<button class="admin-page-btn" data-page="' + (current < totalPages ? current + 1 : totalPages) + '"' + (current >= totalPages ? ' disabled' : '') + '>&rsaquo;</button>';
    html += '</div>'; // 关闭 admin-pager

    // 跳转区域
    html += '<div class="admin-pagination-jump">';
    html += '<span class="admin-jump-label">前往</span>';
    html += '<input type="number" class="admin-page-jumper" min="1" max="' + totalPages + '" value="' + current + '" />';
    html += '<span class="admin-jump-label">页</span>';
    html += '</div>'; // 关闭 jump
    html += '</div>'; // 关闭 admin-pagination-right

    container.innerHTML = html;

    // 绑定事件
    container.querySelectorAll('[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var page = parseInt(this.getAttribute('data-page'), 10);
        if (page !== current && !this.disabled) {
          options.onChange(page, pageSize);
        }
      });
    });
    var sizeSelect = container.querySelector('#page-size-select');
    if (sizeSelect) {
      sizeSelect.addEventListener('change', function () {
        options.onChange(1, parseInt(this.value, 10));
      });
    }
    var jumper = container.querySelector('.admin-page-jumper');
    if (jumper) {
      jumper.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var page = parseInt(this.value, 10);
          if (page >= 1 && page <= totalPages && page !== current) {
            options.onChange(page, pageSize);
          }
        }
      });
    }
  }

  // ===== 表格渲染器 =====
  // 容器、列配置、数据 → 渲染表格
  // columns: [{ key, title, width, align, render(row, index) => html, type: 'checkbox' }]
  function renderTable(container, columns, data, options) {
    options = options || {};
    if (!container) return;
    if (!data || data.length === 0) {
      container.innerHTML = '<div class="admin-empty"><p>' + esc(options.emptyText || '暂无数据') + '</p></div>';
      return;
    }

    var html = '<div class="admin-table-wrap"><div class="admin-table-scroll"><table class="admin-table"><thead><tr>';
    // 表头
    columns.forEach(function (col) {
      var style = '';
      if (col.width) style += 'width:' + col.width + ';';
      if (col.align) style += 'text-align:' + col.align + ';';
      if (col.type === 'checkbox') {
        html += '<th style="width:50px;text-align:center;"><input type="checkbox" class="admin-table-check-all" /></th>';
      } else {
        html += '<th' + (style ? ' style="' + style + '"' : '') + '>' + esc(col.title || '') + '</th>';
      }
    });
    html += '</tr></thead><tbody>';

    // 数据行
    data.forEach(function (row, index) {
      html += '<tr data-index="' + index + '" data-id="' + esc(row.id) + '">';
      columns.forEach(function (col) {
        if (col.type === 'checkbox') {
          html += '<td style="text-align:center;"><input type="checkbox" class="admin-table-check" value="' + esc(row.id) + '" /></td>';
        } else {
          var cellHtml = '';
          if (col.render) {
            cellHtml = col.render(row, index);
          } else {
            cellHtml = esc(row[col.key]);
          }
          var style = '';
          if (col.align) style += 'text-align:' + col.align + ';';
          html += '<td' + (style ? ' style="' + style + '"' : '') + '>' + cellHtml + '</td>';
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';
    container.innerHTML = html;

    // 全选/取消全选
    var checkAll = container.querySelector('.admin-table-check-all');
    if (checkAll) {
      checkAll.addEventListener('change', function () {
        var checked = this.checked;
        container.querySelectorAll('.admin-table-check').forEach(function (cb) { cb.checked = checked; });
        if (options.onSelectionChange) {
          options.onSelectionChange(getSelectedIds(container));
        }
      });
      // 单个 checkbox 变化
      container.querySelectorAll('.admin-table-check').forEach(function (cb) {
        cb.addEventListener('change', function () {
          var allCbs = container.querySelectorAll('.admin-table-check');
          var checkedCbs = container.querySelectorAll('.admin-table-check:checked');
          checkAll.checked = allCbs.length > 0 && allCbs.length === checkedCbs.length;
          if (options.onSelectionChange) {
            options.onSelectionChange(getSelectedIds(container));
          }
        });
      });
    }
  }

  function getSelectedIds(container) {
    var ids = [];
    container.querySelectorAll('.admin-table-check:checked').forEach(function (cb) {
      ids.push(cb.value);
    });
    return ids;
  }

  // ===== 加载/空状态 =====
  function showLoading(container) {
    if (!container) return;
    container.innerHTML = '<div class="admin-loading"><div class="admin-loading-spinner"></div><p>加载中...</p></div>';
  }

  function showError(container, msg) {
    if (!container) return;
    container.innerHTML = '<div class="admin-empty"><p>' + esc(msg || '加载失败') + '</p>' +
      '<button class="glass-btn glass-btn-ghost glass-btn-sm" style="margin-top:12px;" onclick="location.reload()">重新加载</button></div>';
  }

  // ===== CRUD 页面工厂 =====
  // 封装标准列表页逻辑：搜索、分页、新增、编辑、删除
  // config: {
  //   container,        // 列表容器
  //   paginationEl,     // 分页容器
  //   searchForm,       // 搜索表单 DOM（可选）
  //   columns,          // 列配置
  //   listApi(params),  // 列表 API
  //   deleteApi(id),    // 删除 API
  //   deleteLabel(row), // 删除提示文案
  //   emptyText,
  //   onEdit(row),      // 编辑回调
  //   onAdd(),          // 新增回调
  //   onSelectionChange(ids),
  //   defaultQuery,     // 默认查询参数
  // }
  function createCrudList(config) {
    var state = {
      pageNum: 1,
      pageSize: 10,
      total: 0,
      query: config.defaultQuery || {},
      loading: false,
    };

    function loadList() {
      if (state.loading) return;
      state.loading = true;
      showLoading(config.container);
      var params = Object.assign({}, state.query, {
        pageNum: state.pageNum,
        pageSize: state.pageSize,
      });
      config.listApi(params).then(function (data) {
        state.loading = false;
        var page = getPageRecords(data);
        // 当前页为空且非首页：直接跳到最后一页重新加载
        if (page.list.length === 0 && state.pageNum > 1) {
          var tp = Math.ceil(page.total / state.pageSize) || 1;
          state.pageNum = Math.min(state.pageNum - 1, tp);
          if (state.pageNum < 1) state.pageNum = 1;
          return loadList();
        }
        state.total = page.total;
        renderTable(config.container, config.columns, page.list, {
          emptyText: config.emptyText,
          onSelectionChange: config.onSelectionChange,
        });
        if (config.paginationEl) {
          renderPagination(config.paginationEl, {
            current: state.pageNum,
            pageSize: state.pageSize,
            total: state.total,
            onChange: function (pageNum, pageSize) {
              state.pageNum = pageNum;
              state.pageSize = pageSize;
              loadList();
            },
          });
        }
      }).catch(function (err) {
        state.loading = false;
        showError(config.container, err.message);
      });
    }

    function search(query) {
      state.query = query || {};
      state.pageNum = 1;
      loadList();
    }

    function refresh() {
      loadList();
    }

    function handleDelete(row) {
      var label = config.deleteLabel ? config.deleteLabel(row) : ('ID: ' + row.id);
      confirmDialog('确定要删除「' + label + '」吗？', function () {
        config.deleteApi(row.id).then(function () {
          toast('删除成功', 'success');
          refresh();
        }).catch(function (err) {
          toast(err.message || '删除失败', 'error');
        });
      });
    }

    function handleBatchDelete(ids) {
      if (!ids || ids.length === 0) {
        toast('请先选择要删除的数据', 'info');
        return;
      }
      confirmDialog('确定要删除选中的 ' + ids.length + ' 条数据吗？', function () {
        config.deleteApi(ids.join(',')).then(function () {
          toast('批量删除成功', 'success');
          refresh();
        }).catch(function (err) {
          toast(err.message || '批量删除失败', 'error');
        });
      });
    }

    return {
      state: state,
      load: loadList,
      search: search,
      refresh: refresh,
      deleteRow: handleDelete,
      batchDelete: handleBatchDelete,
    };
  }

  // ===== 状态徽章 =====
  function badge(text, type) {
    return '<span class="admin-badge admin-badge-' + (type || 'default') + '">' + esc(text) + '</span>';
  }

  // ===== 图片缩略图 =====
  function thumbImg(src, alt) {
    if (!src) return '<span style="color:var(--text-tertiary);font-size:0.8rem;">无</span>';
    return '<img class="cell-img" src="' + esc(src) + '" alt="' + esc(alt || '') + '" onerror="this.style.display=\'none\'" />';
  }

  // ===== 操作按钮 =====
  // variant: 'edit' | 'del' | 'view' | 'success' | 'perm' (默认按 cls 推断)
  function actBtn(label, cls, onClick, dataId) {
    var id = dataId || '';
    return '<button type="button" class="' + cls + '" data-id="' + esc(id) + '">' + esc(label) + '</button>';
  }

  // ===== 图片上传 API =====
  // 上传文件到 /file/upload，返回 url
  function uploadFile(file, source) {
    var formData = new FormData();
    formData.append('file', file);
    var headers = {};
    var token = getToken();
    if (token) headers['Authorization'] = token;
    return fetch('/file/upload' + (source ? '?source=' + encodeURIComponent(source) : ''), {
      method: 'POST',
      headers: headers,
      body: formData,
      credentials: 'include',
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.code !== undefined && d.code !== 200 && d.code !== 0) {
        throw new Error(d.message || '上传失败');
      }
      return (d && d.data !== undefined) ? d.data : d;
    });
  }

  // 删除文件
  function deleteFile(url) {
    return request('/file/delete', { method: 'DELETE', params: { url: url } });
  }

  // ===== 图片上传组件 =====
  // options: { container, value(url或url数组), multiple, size('sm'), source, onChange }
  function createUploadField(options) {
    var container = options.container;
    if (!container) return;
    var multiple = options.multiple || false;
    var sizeClass = options.size === 'sm' ? ' admin-upload-sm' : '';
    var source = options.source || '';
    var onChange = options.onChange || function () {};

    function getValues() {
      if (multiple) {
        return Array.isArray(options.value) ? options.value.slice() : (options.value ? [options.value] : []);
      }
      return options.value ? [options.value] : [];
    }

    function render() {
      var vals = getValues();
      var html = '<div class="admin-upload' + sizeClass + '">';
      vals.forEach(function (url, i) {
        html += '<div class="admin-upload-item" data-url="' + esc(url) + '">' +
          '<img src="' + esc(url) + '" alt="" onerror="this.style.opacity=0.2" />' +
          '<div class="admin-upload-actions">' +
            '<button type="button" class="admin-upload-btn del" data-act="del" data-idx="' + i + '" title="删除">' +
              '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>';
      });
      if (multiple || vals.length === 0) {
        html += '<div class="admin-upload-trigger" data-act="upload">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
          '<span>点击上传</span>' +
        '</div>';
      }
      html += '</div>';
      html += '<input type="file" accept="image/*" style="display:none;" />';
      container.innerHTML = html;
      bindEvents();
    }

    function bindEvents() {
      var trigger = container.querySelector('[data-act="upload"]');
      var fileInput = container.querySelector('input[type="file"]');
      if (trigger && fileInput) {
        trigger.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
          var file = this.files[0];
          if (!file) return;
          // 文件大小限制 5MB
          if (file.size > 5 * 1024 * 1024) {
            toast('图片大小不能超过 5MB', 'error');
            return;
          }
          trigger.classList.add('uploading');
          uploadFile(file, source).then(function (url) {
            if (multiple) {
              var vals = getValues();
              vals.push(url);
              options.value = vals;
            } else {
              options.value = url;
            }
            onChange(options.value);
            render();
          }).catch(function (err) {
            toast(err.message || '上传失败', 'error');
          }).then(function () {
            if (trigger) trigger.classList.remove('uploading');
          });
          fileInput.value = '';
        });
      }
      // 删除按钮
      container.querySelectorAll('[data-act="del"]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var idx = parseInt(btn.getAttribute('data-idx'), 10);
          var url = btn.closest('.admin-upload-item').getAttribute('data-url');
          if (multiple) {
            var vals = getValues();
            vals.splice(idx, 1);
            options.value = vals;
          } else {
            options.value = '';
          }
          onChange(options.value);
          render();
        });
      });
    }

    render();
    return {
      getValue: function () { return options.value; },
      setValue: function (v) { options.value = v; render(); },
      render: render,
    };
  }

  // ===== 富文本编辑器 =====
  // options: { container, value(html), placeholder, onChange }
  function createRichEditor(options) {
    var container = options.container;
    if (!container) return;

    var tools = [
      { cmd: 'bold', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>', title: '加粗' },
      { cmd: 'italic', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>', title: '斜体' },
      { sep: true },
      { cmd: 'formatBlock', val: 'h2', label: 'H2', title: '标题' },
      { cmd: 'formatBlock', val: 'h3', label: 'H3', title: '副标题' },
      { cmd: 'formatBlock', val: 'p', label: 'P', title: '正文' },
      { sep: true },
      { cmd: 'insertUnorderedList', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>', title: '无序列表' },
      { cmd: 'insertOrderedList', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>', title: '有序列表' },
      { sep: true },
      { cmd: 'createLink', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>', title: '链接' },
      { cmd: 'insertImage', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>', title: '图片' },
      { cmd: 'formatBlock', val: 'blockquote', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>', title: '引用' },
      { cmd: 'removeFormat', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V4h13M9 20h6M11 4l-4 12"/><line x1="17" y1="13" x2="22" y2="18"/><line x1="22" y1="13" x2="17" y2="18"/></svg>', title: '清除格式' },
    ];

    var html = '<div class="admin-editor-toolbar">';
    tools.forEach(function (t) {
      if (t.sep) {
        html += '<span class="admin-editor-sep"></span>';
      } else if (t.icon) {
        html += '<button type="button" class="admin-editor-tool" data-cmd="' + (t.cmd || '') + '" data-val="' + (t.val || '') + '" title="' + esc(t.title || '') + '">' + t.icon + '</button>';
      } else {
        html += '<button type="button" class="admin-editor-tool" data-cmd="' + (t.cmd || '') + '" data-val="' + (t.val || '') + '" title="' + esc(t.title || '') + '">' + esc(t.label || '') + '</button>';
      }
    });
    html += '</div>';
    html += '<div class="admin-editor-content" contenteditable="true" data-placeholder="' + esc(options.placeholder || '请输入内容...') + '"></div>';
    container.innerHTML = html;

    var contentEl = container.querySelector('.admin-editor-content');
    contentEl.innerHTML = options.value || '';

    container.querySelectorAll('.admin-editor-tool').forEach(function (btn) {
      btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
      btn.addEventListener('click', function () {
        var cmd = btn.getAttribute('data-cmd');
        var val = btn.getAttribute('data-val');
        contentEl.focus();
        if (cmd === 'createLink') {
          var url = window.prompt('请输入链接地址：', 'https://');
          if (url) document.execCommand('createLink', false, url);
        } else if (cmd === 'insertImage') {
          var imgUrl = window.prompt('请输入图片地址：', 'https://');
          if (imgUrl) document.execCommand('insertImage', false, imgUrl);
        } else if (cmd === 'formatBlock') {
          document.execCommand('formatBlock', false, val);
        } else {
          document.execCommand(cmd, false, null);
        }
        if (options.onChange) options.onChange(contentEl.innerHTML);
      });
    });

    contentEl.addEventListener('input', function () {
      if (options.onChange) options.onChange(contentEl.innerHTML);
    });

    return {
      getValue: function () { return contentEl.innerHTML; },
      setValue: function (v) { contentEl.innerHTML = v || ''; },
    };
  }

  // ===== 树形控件渲染（用于权限分配/菜单展示） =====
  // options: { container, data(tree), checkbox, defaultExpand, onCheck, getIcon }
  function renderTree(options) {
    var container = options.container;
    if (!container) return;
    var checkbox = options.checkbox || false;
    var defaultExpand = options.defaultExpand || false;
    var checkedSet = {};
    (options.checkedIds || []).forEach(function (id) { checkedSet[id] = true; });
    var onCheck = options.onCheck || function () {};
    var getIcon = options.getIcon || function () { return ''; };

    function buildNode(node) {
      var children = node.children || [];
      var hasChildren = children.length > 0;
      var isExpanded = defaultExpand;
      var iconHtml = getIcon(node);
      var html = '<div class="admin-tree-node" data-id="' + esc(node.id) + '">';
      html += '<div class="admin-tree-row">';
      html += '<span class="admin-tree-toggle' + (hasChildren ? '' : ' leaf') + (isExpanded ? ' expanded' : '') + '">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
        '</span>';
      if (checkbox) {
        var checked = checkedSet[node.id] ? ' checked' : '';
        html += '<input type="checkbox" class="admin-tree-checkbox" value="' + esc(node.id) + '"' + checked + ' />';
      }
      if (iconHtml) html += '<span class="admin-tree-icon">' + iconHtml + '</span>';
      html += '<span class="admin-tree-label">' + esc(node.title || node.name || '') + '</span>';
      html += '</div>';
      if (hasChildren) {
        html += '<div class="admin-tree-children"' + (isExpanded ? '' : ' style="display:none;"') + '>';
        children.forEach(function (child) { html += buildNode(child); });
        html += '</div>';
      }
      html += '</div>';
      return html;
    }

    var html = '<div class="admin-tree">';
    (options.data || []).forEach(function (node) { html += buildNode(node); });
    html += '</div>';
    container.innerHTML = html;

    // 展开/折叠
    container.querySelectorAll('.admin-tree-toggle:not(.leaf)').forEach(function (toggle) {
      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var node = toggle.closest('.admin-tree-node');
        var children = node.querySelector('.admin-tree-children');
        if (children) {
          var isHidden = children.style.display === 'none';
          children.style.display = isHidden ? '' : 'none';
          toggle.classList.toggle('expanded', isHidden);
        }
      });
    });

    // checkbox 联动
    if (checkbox) {
      container.querySelectorAll('.admin-tree-checkbox').forEach(function (cb) {
        cb.addEventListener('change', function () {
          var node = cb.closest('.admin-tree-node');
          var nodeId = cb.value;
          // 联动子节点
          node.querySelectorAll('.admin-tree-children .admin-tree-checkbox').forEach(function (childCb) {
            childCb.checked = cb.checked;
          });
          // 联动父节点（如果所有兄弟都取消则父也取消）
          updateParentCheck(node);
          onCheck(getCheckedIds());
        });
      });
    }

    function updateParentCheck(nodeEl) {
      var parent = nodeEl.parentElement.closest('.admin-tree-node');
      if (!parent) return;
      var parentCb = parent.querySelector(':scope > .admin-tree-row > .admin-tree-checkbox');
      if (!parentCb) return;
      var siblings = parent.querySelectorAll(':scope > .admin-tree-children .admin-tree-node > .admin-tree-row > .admin-tree-checkbox');
      var allChecked = true;
      var someChecked = false;
      siblings.forEach(function (s) {
        if (s.checked) someChecked = true;
        else allChecked = false;
      });
      parentCb.checked = allChecked;
      parentCb.indeterminate = !allChecked && someChecked;
      updateParentCheck(parent);
    }

    function getCheckedIds() {
      var ids = [];
      container.querySelectorAll('.admin-tree-checkbox:checked').forEach(function (cb) {
        ids.push(cb.value);
      });
      return ids;
    }

    return {
      getCheckedIds: getCheckedIds,
      setCheckedIds: function (ids) {
        checkedSet = {};
        ids.forEach(function (id) { checkedSet[id] = true; });
        container.querySelectorAll('.admin-tree-checkbox').forEach(function (cb) {
          cb.checked = !!checkedSet[cb.value];
        });
      },
    };
  }

  // ===== 导出 =====
  window.Admin = {
    // 基础
    api: api,
    request: request,
    getToken: getToken,
    isLoggedIn: isLoggedIn,
    // 工具
    esc: esc,
    formatDate: formatDate,
    debounce: debounce,
    getPageRecords: getPageRecords,
    // UI
    toast: toast,
    confirm: confirmDialog,
    openModal: openModal,
    closeModal: closeModal,
    serializeForm: serializeForm,
    fillForm: fillForm,
    resetForm: resetForm,
    renderPagination: renderPagination,
    renderTable: renderTable,
    showLoading: showLoading,
    showError: showError,
    // 工厂
    createCrudList: createCrudList,
    // 辅助
    badge: badge,
    thumbImg: thumbImg,
    actBtn: actBtn,
    // 图片上传
    uploadFile: uploadFile,
    deleteFile: deleteFile,
    createUploadField: createUploadField,
    // 富文本编辑器
    createRichEditor: createRichEditor,
    // 树形控件
    renderTree: renderTree,
  };
})();
