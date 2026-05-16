/**
 * Relative to `API_BASE_URL`. Most paths go through `api.php?path=…`; entries ending in `.php` are called as real scripts.
 */

export const API_ENDPOINTS = {
  /** GET — `health.php` (same handler as `api.php?path=health`). */
  HEALTH: '/health.php',

  /** Files land under `Backend/uploads/*` — see `Backend/routes/uploads.php`. */
  UPLOADS: {
    /** POST multipart `file`; optional `productId`, `altText`, `isPrimary`. */
    IMAGE: '/uploads/image',
    /** POST multipart `file`; optional `customerId`, `documentType` (admin). */
    CONTRACT: '/uploads/contract',
    /** POST multipart `file` — `file_uploads` registry (auth). */
    FILE: '/uploads/file',
    /** GET — paginated `file_uploads` (admin). */
    FILES_LIST: '/uploads/files',
    /** DELETE — `file_uploads.id` (admin). */
    FILE_DELETE: '/uploads/files/:id',
    /** GET — list documents for a customer (admin). */
    CONTRACTS_BY_CUSTOMER: '/uploads/contracts/:customerId',
    /** DELETE — `customer_documents.id` (admin). */
    DELETE: '/uploads/:id',
  },

  /** Site config — `settings` table (Backend/routes/settings.php). */
  SETTINGS: {
    PUBLIC: '/settings/public',
    /** GET — tax/shipping/currency for cart (no auth). */
    STOREFRONT: '/settings/storefront',
    LIST: '/settings',
  },

  /** Configurable tax rates (Backend/routes/tax-rates.php). */
  TAX_RATES: {
    /** GET — active rates (public, no auth). */
    LIST: '/tax-rates',
    /** GET — all rates including inactive (admin). */
    ALL: '/tax-rates/all',
    /** POST — create (admin). */
    CREATE: '/tax-rates',
    /** PUT — update (admin). */
    UPDATE: '/tax-rates/:id',
    /** DELETE — soft-delete (admin). */
    DELETE: '/tax-rates/:id',
    /** POST — bulk reorder (admin). */
    REORDER: '/tax-rates/reorder',
  },

  /** Contact page Leaflet location — `remquip_contact_map` (Backend/routes/contact-map.php). */
  CONTACT_MAP: {
    GET: '/contact-map',
    UPDATE: '/contact-map',
  },

  /** Landing page design tokens — `remquip_landing_theme` (Backend/routes/landing-theme.php). */
  LANDING_THEME: {
    GET: '/landing-theme',
    UPDATE: '/landing-theme',
  },

  // ==================== AUTH ENDPOINTS ====================
  AUTH: {
    LOGIN: '/auth/login',
    ADMIN_SIGNUP: '/auth/admin-signup',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    VERIFY: '/auth/verify',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },

  // ==================== USERS ENDPOINTS ====================
  /** Per-user settings live under USER_DASHBOARD; avatar via UPDATE body `avatar_url`. */
  USERS: {
    LIST: '/users',
    CREATE: '/users',
    PROFILE: '/users/profile',
    GET: '/users/:id',
    UPDATE: '/users/:id',
    DELETE: '/users/:id',
    UPDATE_PASSWORD: '/users/:id/password',
    /** POST: multipart `file` (csv/json) or JSON `{ users: [...] }` (admin). */
    IMPORT: '/users/import',
  },

  // ==================== PRODUCTS ENDPOINTS ====================
  PRODUCTS: {
    LIST: '/products',
    CREATE: '/products',
    GET: '/products/:id',
    UPDATE: '/products/:id',
    DELETE: '/products/:id',
    SEARCH: '/products/search',
    FEATURED: '/products/featured',
    BY_CATEGORY: '/products/category/:categoryId',
    /** GET admin — sales + revenue + view stats for one product. */
    STATS: '/products/:id/stats',
    /** GET — per-customer augmentations for a product (admin). */
    CUSTOMER_PRICES: '/products/:id/customer-prices',
    /** POST — add/update per-customer augmentation (admin). */
    SET_CUSTOMER_PRICE: '/products/:id/customer-prices',
    /** DELETE — remove per-customer augmentation (admin). */
    DELETE_CUSTOMER_PRICE: '/products/:id/customer-prices/:cpId',
  },

  // ==================== PRODUCT IMAGES ENDPOINTS ====================
  PRODUCT_IMAGES: {
    LIST: '/products/:id/images',
    UPLOAD: '/products/:id/images',
    DELETE: '/products/:id/images/:imageId',
    UPDATE: '/products/:id/images/:imageId',
  },

  // ==================== CATEGORIES ENDPOINTS ====================
  CATEGORIES: {
    LIST: '/categories',
    CREATE: '/categories',
    GET: '/categories/:id',
    UPDATE: '/categories/:id',
    DELETE: '/categories/:id',
    /** GET/PUT — admin; body `{ en?: { name, description }, fr?: { ... } }` */
    TRANSLATIONS: '/categories/:id/translations',
  },

  // ==================== CUSTOMERS ENDPOINTS ====================
  CUSTOMERS: {
    LIST: '/customers',
    CREATE: '/customers',
    GET: '/customers/:id',
    UPDATE: '/customers/:id',
    DELETE: '/customers/:id',
    SEARCH: '/customers/search',
    ORDERS: '/customers/:id/orders',
    ADDRESSES: '/customers/:id/addresses',
    /** POST: multipart `file` (csv/json) or JSON `{ customers: [...] }` (admin). */
    IMPORT: '/customers/import',
    /** POST: public contact form lead capture */
    CONTACT_LEAD: '/customers/contact-leads',
    TASKS: {
      LIST: '/customers/:id/tasks',
      UPDATE: '/customers/tasks/:taskId',
      OVERDUE: '/customers/tasks/overdue',
      UPCOMING: '/customers/tasks/upcoming',
    },
    NOTES: {
      ADD: '/customers/:id/notes',
      UPDATE: '/customers/:id/notes/:noteId',
      DELETE: '/customers/:id/notes/:noteId',
    },
    CONVERT_TO_CUSTOMER: '/customers/:id/convert-to-customer',
  },

  // ==================== LEAD STATUSES ====================
  LEAD_STATUSES: {
    LIST: '/lead-statuses',
    CREATE: '/lead-statuses',
    UPDATE: '/lead-statuses/:id',
    DELETE: '/lead-statuses/:id',
  },

  // ==================== TASKS (standalone) ====================
  TASKS: {
    LIST: '/tasks',
    CREATE: '/tasks',
    UPDATE: '/tasks/:id',
    DELETE: '/tasks/:id',
  },

  // ==================== ORDERS ENDPOINTS ====================
  ORDERS: {
    LIST: '/orders',
    CREATE: '/orders',
    GET: '/orders/:id',
    UPDATE: '/orders/:id',
    DELETE: '/orders/:id',
    SEARCH: '/orders/search',
    STATUS: '/orders/:id/status',
    TRACKING: '/orders/:id/tracking',
    ADD_NOTE: '/orders/:id/notes',
    GET_NOTES: '/orders/:id/notes',
    USER_ORDERS: '/users/:userId/orders',
    /** POST — send email to customer about order (email_type: 'status'|'custom'). */
    SEND: '/orders/:id/send',
    DOCUMENTS: '/orders/:id/documents',
    DOCUMENT_DELETE: '/orders/:id/documents/:documentId',
    /** PATCH — update line item quantity. */
    ITEM_UPDATE: '/orders/:id/items/:itemId',
    /** DELETE — remove a line item from an order. */
    ITEM_DELETE: '/orders/:id/items/:itemId',
  },

  // ==================== OFFERS ENDPOINTS ====================
  OFFERS: {
    LIST: '/offers',
    CREATE: '/offers',
    GET: '/offers/:id',
    UPDATE: '/offers/:id',
    DELETE: '/offers/:id',
    STATUS: '/offers/:id/status',
    /** POST — convert offer to order. */
    CONVERT: '/offers/:id/convert',
    /** POST — convert offer to invoice. */
    CONVERT_INVOICE: '/offers/:id/convert-invoice',
    /** POST — send offer email to customer. */
    SEND: '/offers/:id/send',
    DOCUMENTS: '/offers/:id/documents',
    DOCUMENT_DELETE: '/offers/:id/documents/:documentId',
  },

  // ==================== DISCOUNTS ENDPOINTS ====================
  DISCOUNTS: {
    LIST: '/discounts',
    CREATE: '/discounts',
    GET: '/discounts/:id',
    UPDATE: '/discounts/:id',
    DELETE: '/discounts/:id',
    VALIDATE: '/discounts/validate/:code',
  },

  // ==================== INVENTORY ENDPOINTS ====================
  INVENTORY: {
    LOGS: '/inventory/logs',
    ADJUST: '/inventory/adjust',
    LOW_STOCK: '/inventory/low-stock',
    HISTORY: '/inventory/product/:productId/history',
  },

  // ==================== ANALYTICS ENDPOINTS ====================
  ANALYTICS: {
    DASHBOARD: '/analytics/dashboard',
    DAILY_METRICS: '/analytics/metrics',
    REVENUE: '/analytics/revenue',
    SALES: '/analytics/sales',
    INVENTORY_OVERVIEW: '/analytics/inventory',
    CUSTOMERS_OVERVIEW: '/analytics/customers',
    /** POST — insert `analytics` row (public; optional Bearer). */
    EVENTS: '/analytics/events',
    /** GET — admin paginated events. */
    EVENTS_SUMMARY: '/analytics/events/summary',
  },

  // ==================== DASHBOARD ENDPOINTS ====================
  DASHBOARD: {
    STATS: '/dashboard/stats',
    RECENT_ORDERS: '/dashboard/recent-orders',
    ACTIVITY_LOG: '/dashboard/activity-log',
    TOP_PRODUCTS: '/dashboard/top-products',
  },

  // ==================== CMS ENDPOINTS ====================
  /** Public reads use real `Backend/cms/*.php` files; admin writes use logical paths → api.php (never .php suffix for writes). */
  CMS: {
    PAGES: '/cms/pages.php',
    /** POST — create page (goes through router, NOT direct .php file). */
    CREATE_PAGE: '/cms/pages',
    /** GET ?slug=&locale= */
    GET_PAGE: '/cms/page.php',
    UPDATE_PAGE: '/cms/pages/:id',
    DELETE_PAGE: '/cms/pages/:id',
    /** GET ?slug=&locale= */
    PAGE_CONTENT: '/cms/page-content.php',
    /** GET ?slug=&section= */
    SECTION_CONTENT: '/cms/section.php',
    /** POST body creates/updates a section on a page (Backend: cms.php). */
    CONTENT: '/cms/content',
    /** `id` is `pageUuid:sectionKey` (URL-encoded in client). */
    CONTENT_BY_ID: '/cms/content/:id',
    IMAGES_UPLOAD: '/cms/upload-image.php',
    /** GET/PUT — admin; per-locale title/excerpt/content */
    PAGE_TRANSLATIONS: '/cms/pages/:id/translations',
  },

  /** Hero / marketing banners (Backend routes/cms.php). */
  CMS_BANNERS: {
    LIST: '/cms/banners.php',
    CREATE: '/cms/banners',
    UPDATE: '/cms/banners/:id',
    DELETE: '/cms/banners/:id',
    /** GET/PUT — admin; per-locale title/description */
    TRANSLATIONS: '/cms/banners/:id/translations',
  },

  // ==================== AUDIT ENDPOINTS ====================
  AUDIT: {
    LOGS: '/audit/logs',
    USER_LOGS: '/audit/users/:userId/logs',
  },

  // ==================== ADMIN CONTACTS ENDPOINTS ====================
  ADMIN_CONTACTS: {
    LIST: '/admin-contacts',
    CREATE: '/admin-contacts',
    GET: '/admin-contacts/:id',
    UPDATE: '/admin-contacts/:id',
    DELETE: '/admin-contacts/:id',
    BY_DEPARTMENT: '/admin-contacts/department/:department',
    BY_SPECIALIZATION: '/admin-contacts/specialization/:specialization',
    AVAILABLE: '/admin-contacts/available',
  },

  // ==================== ADMIN PERMISSIONS ENDPOINTS ====================
  ADMIN_PERMISSIONS: {
    GET_USER_PERMISSIONS: '/admin/permissions/user/:userId',
    UPDATE_PERMISSIONS: '/admin/permissions/user/:userId',
    GET_ALL_PERMISSIONS: '/admin/permissions',
    GET_MY_PERMISSIONS: '/admin/my-permissions',
  },

  // ==================== USER DASHBOARD ENDPOINTS ====================
  USER_DASHBOARD: {
    PROFILE: '/user/dashboard/profile',
    ORDERS: '/user/dashboard/orders',
    ORDER_SUMMARY: '/user/dashboard/orders/summary',
    ORDER_RECEIPT: '/user/dashboard/orders/:id/receipt',
    ADDRESSES: '/user/dashboard/addresses',
    SETTINGS: '/user/dashboard/settings',
    UPDATE_SETTINGS: '/user/dashboard/settings',
    CONTACT_US: '/user/dashboard/contacts',
    NOTES: '/user/dashboard/notes',
    INSTALLMENTS: '/user/dashboard/installments',
  },

  // ==================== CHAT ENDPOINTS ====================
  CHAT: {
    /** POST — create conversation + first message (public) */
    CREATE: '/chat',
    /** POST — visitor sends message (public) */
    SEND_MESSAGE: '/chat/:id/messages',
    /** GET — poll messages for a conversation (public) */
    GET_MESSAGES: '/chat/:id/messages',
    /** GET — list all conversations (admin) */
    LIST: '/chat',
    /** GET — single conversation with messages (admin) */
    GET: '/chat/:id',
    /** PATCH — update status (admin) */
    UPDATE: '/chat/:id',
    /** POST — admin reply (admin) */
    REPLY: '/chat/:id/reply',
    /** DELETE — delete conversation (admin) */
  },
  
  // ==================== CARTS ENDPOINTS ====================
  CARTS: {
    /** POST - Save abandoned cart (public) */
    SAVE: '/carts',
    /** GET - List abandoned carts (admin) */
    LIST: '/carts',
    /** PATCH - Update cart status (admin) */
    UPDATE: '/carts/:id',
  },
  
  // ==================== STRIPE ENDPOINTS ====================
  STRIPE: {
    /** POST - Create Stripe Checkout Session */
    CREATE_SESSION: '/stripe/create-checkout-session',
  },

  // ==================== ACCOUNT APPLICATIONS ENDPOINTS ====================
  ACCOUNT_APPLICATIONS: {
    /** POST - Submit application (public) */
    SUBMIT: '/account-applications',
    /** GET - List applications (admin) */
    LIST: '/account-applications',
    /** GET - Get single application */
    GET: '/account-applications/:id',
    /** PATCH - Approve application (admin) */
    APPROVE: '/account-applications/:id/approve',
    /** PATCH - Reject application (admin) */
    REJECT: '/account-applications/:id/reject',
  },

  // ==================== INVOICES ENDPOINTS ====================
  INVOICES: {
    LIST: '/invoices',
    CREATE: '/invoices',
    GET: '/invoices/:id',
    UPDATE: '/invoices/:id',
    DELETE: '/invoices/:id',
    STATUS: '/invoices/:id/status',
    STATS: '/invoices/stats',
    RECORD_PAYMENT: '/invoices/:id/payments',
    /** POST — send invoice email to customer. */
    SEND: '/invoices/:id/send',
  },

  // ==================== SEO ENDPOINTS ====================
  SEO: {
    /** GET ?path=&locale= — public, returns SEO for a specific page */
    GET: '/seo',
    /** GET — public, all active SEO entries */
    ALL: '/seo/all',
    /** GET — admin, all entries including inactive */
    ADMIN_LIST: '/seo/list',
    /** POST — admin, create */
    CREATE: '/seo',
    /** PUT — admin, update */
    UPDATE: '/seo/:id',
    /** DELETE — admin, delete */
    DELETE: '/seo/:id',
  },
} as const;
