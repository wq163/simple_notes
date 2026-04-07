import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      component: () => import('@/views/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'Home',
          component: () => import('@/views/HomeView.vue'),
        },
        {
          path: 'category/:id',
          name: 'Category',
          component: () => import('@/views/HomeView.vue'),
        },
        {
          path: 'tag/:id',
          name: 'Tag',
          component: () => import('@/views/HomeView.vue'),
        },
        {
          path: 'trash',
          name: 'Trash',
          component: () => import('@/views/HomeView.vue'),
        },
        {
          path: 'search',
          name: 'Search',
          component: () => import('@/views/HomeView.vue'),
        },
        {
          path: 'note/new',
          name: 'NewNote',
          redirect: () => ({ path: '/', query: { newNote: 'true' } }),
        },
        {
          path: 'note/:id',
          name: 'EditNote',
          redirect: (to) => ({ path: '/', query: { noteId: to.params.id } }),
        },
        {
          path: 'categories',
          name: 'Categories',
          component: () => import('@/views/CategoriesView.vue'),
        },
        {
          path: 'tags',
          name: 'Tags',
          component: () => import('@/views/TagsView.vue'),
        },
        {
          path: 'settings',
          name: 'Settings',
          component: () => import('@/views/SettingsView.vue'),
        },
        {
          path: 'account',
          name: 'Account',
          component: () => import('@/views/AccountView.vue'),
        },
        {
          path: 'admin/users',
          name: 'AdminUsers',
          component: () => import('@/views/AdminUsersView.vue'),
        },
      ],
    },
  ],
});

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth !== false && !authStore.isLoggedIn) {
    next('/login');
  } else if (to.path === '/login' && authStore.isLoggedIn) {
    next('/');
  } else {
    next();
  }
});

export default router;
