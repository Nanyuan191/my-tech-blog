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
          <el-select v-model="form.categoryId" placeholder="选择分类" clearable>
            <el-option
              v-for="c in categories"
              :key="c.id"
              :label="c.name"
              :value="c.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="标签">
          <el-select v-model="form.tagIds" multiple placeholder="选择标签">
            <el-option v-for="t in tags" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
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
import { ElMessage } from 'element-plus';
import request from '@/api/request';
import { useAuthStore } from '@/stores/auth';
import {
  fetchCategories,
  fetchTags,
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
  summary: '',
  content: '',
  status: 'PUBLISHED' as 'DRAFT' | 'PUBLISHED',
});

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
  form.summary = '';
  form.content = '';
  form.status = 'PUBLISHED';
  editingId.value = null;
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
  try {
    if (editingId.value) {
      await request.put(`/posts/${editingId.value}`, form, { headers });
      ElMessage.success('修改成功');
    } else {
      await request.post('/posts', form, { headers });
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
  margin: 32px auto;
  padding: 0 24px;
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
