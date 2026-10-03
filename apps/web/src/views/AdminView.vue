<template>
  <div class="admin">
    <div class="header">
      <h1>后台管理</h1>
      <div>
        <span class="who">{{ auth.user?.nickname || auth.user?.username }}</span>
        <el-button size="small" @click="handleLogout">退出</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <!-- ==================== 页签一：文章管理 ==================== -->
      <el-tab-pane label="文章管理" name="articles">
        <el-button type="primary" @click="openCreate">写文章</el-button>

        <el-table :data="list" style="width: 100%; margin-top: 20px" v-loading="loading">
          <el-table-column prop="title" label="标题" min-width="200" />
          <el-table-column label="分类" width="110">
            <template #default="{ row }">
              {{ row.category?.name || '未分类' }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === 'PUBLISHED' ? 'success' : 'info'" size="small">
                {{ row.status === 'PUBLISHED' ? '已发布' : '草稿' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="viewCount" label="阅读" width="70" />
          <el-table-column prop="likeCount" label="点赞" width="70" />
          <el-table-column label="操作" width="150">
            <template #default="{ row }">

              <el-button size="small" @click="openEdit(row as Article)">编辑</el-button>
              <el-popconfirm title="确定删除这篇文章？" @confirm="handleDelete((row as Article).id)">
                <template #reference>
                  <el-button size="small" type="danger">删除</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ==================== 页签二：评论审核 ==================== -->
      <el-tab-pane name="comments">
        <template #label>
          <span class="tab-label">
            评论审核
            <!-- 待审核数量做成小红点：不用点进去也知道有没有活要干 -->
            <el-badge v-if="pendingCount > 0" :value="pendingCount" class="tab-badge" />
          </span>
        </template>

        <div class="filter-bar">
          <el-radio-group v-model="commentFilter" @change="loadComments">
            <el-radio-button value="">全部</el-radio-button>
            <el-radio-button value="PENDING">待审核</el-radio-button>
            <el-radio-button value="APPROVED">已通过</el-radio-button>
            <el-radio-button value="REJECTED">已拒绝</el-radio-button>
          </el-radio-group>
          <el-button size="small" @click="loadComments">刷新</el-button>
        </div>

        <el-table :data="commentList" style="width: 100%" v-loading="commentLoading">
          <el-table-column prop="nickname" label="昵称" width="120" />
          <el-table-column prop="email" label="邮箱" width="180" show-overflow-tooltip />
          <el-table-column prop="content" label="内容" min-width="240" show-overflow-tooltip />
          <el-table-column label="文章" width="150" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.article?.title || '（文章已删除）' }}
            </template>
          </el-table-column>
          <el-table-column label="时间" width="130">
            <template #default="{ row }">
              {{ formatTime(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small">
                {{ statusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="210">
            <template #default="{ row }">
              <el-button
                v-if="row.status !== 'APPROVED'"
                size="small"
                type="success"
                @click="handleStatus(row as AdminComment, 'APPROVED')"
              >
                通过
              </el-button>
              <el-button
                v-if="row.status !== 'REJECTED'"
                size="small"
                @click="handleStatus(row as AdminComment, 'REJECTED')"
              >
                拒绝
              </el-button>
              <el-popconfirm title="确定删除这条评论？" @confirm="handleCommentDelete((row as AdminComment).id)">
                <template #reference>
                  <el-button size="small" type="danger">删除</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>

        <p class="tip">
          审核说明：游客留言默认「待审核」，只有「已通过」才会出现在文章页；站长在文章页的回复自动通过。
        </p>
      </el-tab-pane>
    </el-tabs>

    <!-- ==================== 写/编辑文章弹窗 ==================== -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑文章' : '写文章'" width="90%" top="5vh">
      <el-form label-width="70px">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="文章标题" />
        </el-form-item>

        <el-form-item label="分类">
          <div class="tax-row">
            <el-select v-model="form.categoryId" placeholder="选择分类" clearable>
              <el-option
                v-for="c in categories"
                :key="c.id"
                :label="c.name"
                :value="c.id"
              />
            </el-select>
            <!-- 不够用就现场建一个：创建成功后自动加入下拉框并选中 -->
            <el-button @click="handleNewCategory">＋ 新建分类</el-button>
          </div>
        </el-form-item>

        <el-form-item label="标签">
          <div class="tax-row">
            <el-select v-model="form.tagIds" multiple placeholder="选择标签">
              <el-option v-for="t in tags" :key="t.id" :label="t.name" :value="t.id" />
            </el-select>
            <el-button @click="handleNewTag">＋ 新建标签</el-button>
          </div>
        </el-form-item>

        <!--
          封面图：预设素材库（点缩略图即选）+ 自定义外链兜底
          数据库里存的是 "cover:scifi" 这类短标识，首页读的时候翻译成真实图片地址，
          详见 src/utils/covers.ts 顶部注释
        -->
        <el-form-item label="封面图">
          <div class="cover-picker">
            <div class="cover-grid">
              <button
                v-for="p in COVER_PRESETS"
                :key="p.key"
                type="button"
                class="cover-opt"
                :class="{ active: form.coverImage === p.key }"
                :title="`使用「${p.label}」封面`"
                @click="pickPresetCover(p.key)"
              >
                <img :src="p.url" :alt="p.label" />
                <span>{{ p.label }}</span>
              </button>

              <!-- 不使用封面：首页卡片走渐变色兜底 -->
              <button
                type="button"
                class="cover-opt cover-none"
                :class="{ active: !form.coverImage }"
                title="不使用封面图"
                @click="pickPresetCover('')"
              >
                <span class="none-mark">⊘</span>
                <span>不使用</span>
              </button>
            </div>

            <div class="cover-row">
              <el-input
                v-model="form.coverImage"
                placeholder="也可以粘贴自定义图片外链 URL（http:// 或 https://）"
                clearable
                @input="coverBroken = false"
              />
              <!-- 自定义外链才需要预览；预设图已在上方高亮，无需重复 -->
              <img
                v-if="form.coverImage && !isPresetCover(form.coverImage) && !coverBroken"
                :src="form.coverImage"
                class="cover-preview"
                alt="封面预览"
                @error="coverBroken = true"
              />
            </div>
            <p class="cover-tip">预设图不依赖外部图床，永不失效；留空则首页卡片使用渐变色块。</p>
          </div>
        </el-form-item>

        <el-form-item label="摘要">
          <el-input v-model="form.summary" placeholder="不填会自动截取正文前 150 字" />
        </el-form-item>

        <el-form-item label="正文">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="16"
            placeholder="支持 Markdown 语法。例如：&#10;## 二级标题&#10;**加粗**&#10;```js&#10;console.log('hello')&#10;```"
          />
        </el-form-item>

        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="DRAFT">保存为草稿</el-radio>
            <el-radio value="PUBLISHED">立即发布</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          {{ form.status === 'PUBLISHED' ? '发布' : '保存草稿' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/api/request';
import { useAuthStore } from '@/stores/auth';
import {
  fetchCategories,
  fetchTags,
  createCategory,
  createTag,
  type Article,
  type Category,
  type Tag,
} from '@/api/article';
import {
  fetchAdminComments,
  updateCommentStatus,
  deleteComment,
  type AdminComment,
  type CommentStatus,
} from '@/api/comment';
// 封面图素材库：预设选项（点选即用）+ isPresetCover 用于区分"预设标识"和"自定义外链"
import { COVER_PRESETS, isPresetCover } from '@/utils/covers';

const router = useRouter();
const auth = useAuthStore();

// ---- 页签 ----
const activeTab = ref<'articles' | 'comments'>('articles');

// ---- 文章管理 ----
const list = ref<Article[]>([]);
const categories = ref<Category[]>([]);
const tags = ref<Tag[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);

// reactive 适合对象类型的表单
const form = reactive({
  title: '',
  categoryId: undefined as number | undefined,
  tagIds: [] as number[],
  coverImage: '',
  summary: '',
  content: '',
  status: 'PUBLISHED' as 'DRAFT' | 'PUBLISHED',
});

// 封面图 URL 打不开时置 true → 预览图自动隐藏（防裂图）
const coverBroken = ref(false);

/**
 * 选择封面：传入预设 key（如 'cover:scifi'）或空串（不使用封面）。
 * 直接覆盖 form.coverImage —— 预设和自定义外链共用一个字段，二选一。
 */
function pickPresetCover(key: string) {
  form.coverImage = key;
  coverBroken.value = false; // 换图时重置裂图标记，否则上次的失败状态会残留
}

// ---- 评论审核 ----
const commentList = ref<AdminComment[]>([]);
const commentLoading = ref(false);
/** 空字符串 = 全部；用 el-radio-button 的 value 直接对应后端 status 参数 */
const commentFilter = ref<'' | CommentStatus>('');
const pendingCount = ref(0);

/** 后台列表（含草稿） */
async function loadList() {
  loading.value = true;
  try {
    // ⚠️ 返回结构是 { success, data: [...], pagination: {...} }
    // data 直接就是数组，分页信息在**同级**的 pagination 里
    const res = (await request.get('/posts/admin', {
      params: { page: 1, pageSize: 50 },
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })) as unknown as {
      success: boolean;
      data: Article[];
      pagination: unknown;
    };
    list.value = res.data;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

/** 评论列表（可按状态筛选） */
async function loadComments() {
  commentLoading.value = true;
  try {
    const res = await fetchAdminComments(
      {
        // 不传 status 就是"全部"，所以空串要转成 undefined
        status: commentFilter.value || undefined,
        page: 1,
        pageSize: 50,
      },
      auth.accessToken
    );
    commentList.value = res.data;
    // pendingCount 是**不带筛选**的待审核总数，用来显示小红点
    pendingCount.value = res.pendingCount;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '评论加载失败');
  } finally {
    commentLoading.value = false;
  }
}

async function handleStatus(row: AdminComment, status: CommentStatus) {
  try {
    await updateCommentStatus(row.id, status, auth.accessToken);
    ElMessage.success(status === 'APPROVED' ? '已通过，前台可见' : '已拒绝，前台不可见');
    await loadComments();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败');
  }
}

async function handleCommentDelete(id: number) {
  try {
    await deleteComment(id, auth.accessToken);
    ElMessage.success('已删除');
    await loadComments();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败');
  }
}

/** 切到评论页签时才去拉评论，别让首页加载背上无谓的请求 */
function handleTabChange(name: string | number) {
  if (name === 'comments') void loadComments();
}

function statusText(s: CommentStatus) {
  return s === 'APPROVED' ? '已通过' : s === 'REJECTED' ? '已拒绝' : '待审核';
}
function statusTagType(s: CommentStatus) {
  return s === 'APPROVED' ? 'success' : s === 'REJECTED' ? 'danger' : 'warning';
}
function formatTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function resetForm() {
  form.title = '';
  form.categoryId = undefined;
  form.tagIds = [];
  form.coverImage = '';
  form.summary = '';
  form.content = '';
  form.status = 'PUBLISHED';
  editingId.value = null;
  coverBroken.value = false;
}

function openCreate() {
  resetForm();
  dialogVisible.value = true;
}

async function openEdit(row: Article) {
  editingId.value = row.id;
  form.title = row.title;
  form.categoryId = row.category?.id;
  form.tagIds = row.tags.map((t) => t.id);
  form.coverImage = row.coverImage ?? '';
  form.summary = row.summary ?? '';
  form.status = row.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';

  // ⚠️ 列表接口为了性能不返回 content（正文可能几万字），
  // 所以编辑时必须单独拉一次详情，否则打开就是空白的
  // ⚠️⚠️ 必须带 token —— 否则草稿文章会返回 404（实测见 5.2）
  try {
    const res = (await request.get(`/posts/${row.slug}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })) as unknown as {
      success: boolean;
      data: Article & { content: string };
    };
    form.content = res.data.content;
  } catch {
    form.content = '';
    ElMessage.warning('正文加载失败，请重新填写');
  }

  dialogVisible.value = true;
}

async function handleSave() {
  if (!form.title.trim()) {
    ElMessage.warning('请填写标题');
    return;
  }
  if (!form.content.trim()) {
    ElMessage.warning('请填写正文');
    return;
  }

  saving.value = true;
  // 写接口需要鉴权，手动带上 access token
  const headers = { Authorization: `Bearer ${auth.accessToken}` };
  // 封面图只传有效值：空串转 undefined，避免把空字符串存进数据库
  const payload = { ...form, coverImage: form.coverImage.trim() || undefined };
  try {
    if (editingId.value) {
      await request.put(`/posts/${editingId.value}`, payload, { headers });
      ElMessage.success('修改成功');
    } else {
      await request.post('/posts', payload, { headers });
      ElMessage.success('发布成功');
    }
    dialogVisible.value = false;
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

/**
 * 弹窗里直接新建分类：调后端 POST /categories（接口早就有了，之前缺前端入口），
 * 成功后把新分类塞进下拉框选项并自动选中 —— 全程不用离开写文章弹窗。
 */
async function handleNewCategory() {
  try {
    const { value } = await ElMessageBox.prompt('给新分类起个名字', '新建分类', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '分类名不能为空',
    });
    const res = await createCategory((value ?? '').trim(), auth.accessToken);
    categories.value = [...categories.value, res.data];
    form.categoryId = res.data.id;
    ElMessage.success(`分类「${res.data.name}」已创建并选中`);
  } catch (e) {
    // ElMessageBox 点取消/关闭时 reject 的是字符串 'cancel'/'close'，不算错误
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : '创建分类失败');
    }
  }
}

/** 同上，新建标签；创建后自动追加到已选标签里 */
async function handleNewTag() {
  try {
    const { value } = await ElMessageBox.prompt('给新标签起个名字', '新建标签', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '标签名不能为空',
    });
    const res = await createTag((value ?? '').trim(), auth.accessToken);
    tags.value = [...tags.value, res.data];
    if (!form.tagIds.includes(res.data.id)) form.tagIds.push(res.data.id);
    ElMessage.success(`标签「${res.data.name}」已创建并选中`);
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : '创建标签失败');
    }
  }
}

async function handleDelete(id: number) {
  try {
    await request.delete(`/posts/${id}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
    ElMessage.success('已删除');
    await loadList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败');
  }
}

async function handleLogout() {
  await auth.logout();
  router.push('/login');
}

onMounted(async () => {
  await loadList();
  // 分类和标签用来填下拉框，失败也不影响主流程
  try {
    const [c, t] = await Promise.all([fetchCategories(), fetchTags()]);
    categories.value = c.data;
    tags.value = t.data;
  } catch {
    /* 忽略 */
  }
  // 待审核数量：进后台就先看一眼，不用切页签
  void loadComments();
});
</script>

<style scoped>
.admin {
  max-width: 1000px;
  /* 2026-10-03 船长要求：后台背景改纯白（黑底只留给前台）。
     做成白色大圆角面板铺满一屏，高度不够视口时也拉满，避免下面露出黑边 */
  min-height: calc(100vh - 96px);
  margin: 24px auto 48px;
  padding: 28px 28px 40px;
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  font-family: system-ui, sans-serif;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.header h1 {
  margin: 0;
  font-size: 22px;
}
.who {
  margin-right: 12px;
  color: var(--text-muted);
}
/* 分类/标签下拉框 + 「新建」按钮的一行布局：select 占满、按钮固定宽 */
.tax-row {
  display: flex;
  gap: 10px;
  width: 100%;
}
.tax-row .el-select {
  flex: 1;
}
/* ---- 封面图：预设缩略图选择器 ---- */
.cover-picker {
  width: 100%;
}
/* 缩略图网格：自动换行，每张固定 108px 宽 */
.cover-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}
/* 单个选项：图片 + 名字，选中时描边高亮 */
.cover-opt {
  width: 108px;
  padding: 0;
  border: 2px solid #e3e6eb;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  overflow: hidden;
  font-family: inherit;
  line-height: 1;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.cover-opt:hover {
  border-color: #c3cad3;
}
.cover-opt.active {
  border-color: var(--accent, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.16);
}
.cover-opt img {
  display: block;
  width: 100%;
  height: 60px;
  object-fit: cover;
}
.cover-opt span {
  display: block;
  padding: 5px 0 6px;
  font-size: 12px;
  color: var(--text-main);
  text-align: center;
}
/* 「不使用」选项：虚线框 + 灰字，跟真图选项区分开 */
.cover-opt.cover-none {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 85px;
  border-style: dashed;
  color: var(--text-muted);
}
.cover-opt.cover-none .none-mark {
  font-size: 20px;
  padding: 0 0 4px;
  color: inherit;
}
.cover-tip {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}
/* 自定义外链输入 + 预览：预览固定 120x68（16:9 缩略），URL 加载失败自动隐藏 */
.cover-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.cover-row .el-input {
  flex: 1;
}
.cover-preview {
  width: 120px;
  height: 68px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border-soft);
  flex: none;
}
.tab-label {
  display: inline-flex;
  align-items: center;
}
/* el-badge 默认是绝对定位，这里稍微挪一下让它跟在文字后面 */
.tab-badge {
  margin-left: 10px;
  margin-top: -2px;
}
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.tip {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.7;
  margin-top: 14px;
}
</style>
