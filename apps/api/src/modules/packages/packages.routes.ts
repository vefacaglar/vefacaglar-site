import { FastifyInstance } from "fastify";
import { Type, Static } from "@sinclair/typebox";
import { container } from "../../container";
import { CreatePackageHandler } from "./dashboard/create/create.handler";
import { CreatePackageRequest, CreatePackageRequestSchema, PackageResponseSchema } from "./dashboard/create/create.schema";
import { ListAdminPackagesHandler } from "./dashboard/list/list.handler";
import { ListAdminPackagesQuery, ListAdminPackagesQuerySchema, ListAdminPackagesResponseSchema } from "./dashboard/list/list.schema";
import { GetAdminPackageHandler } from "./dashboard/detail/detail.handler";
import { GetAdminPackageParams, GetAdminPackageParamsSchema, GetAdminPackageResponseSchema } from "./dashboard/detail/detail.schema";
import { UpdatePackageHandler } from "./dashboard/update/update.handler";
import { UpdatePackageParams, UpdatePackageParamsSchema, UpdatePackageRequest, UpdatePackageRequestSchema, UpdatePackageResponseSchema } from "./dashboard/update/update.schema";
import { DeletePackageHandler } from "./dashboard/delete/delete.handler";
import { DeletePackageParams, DeletePackageParamsSchema, DeletePackageResponseSchema } from "./dashboard/delete/delete.schema";
import { ErrorResponseSchema } from "../../shared/error-schema";
import { PACKAGES_REPOSITORY } from "./packages.tokens";
import type { IPackagesRepository } from "./packages.repository.interface";
import { NotFoundError, ConflictError } from "../../shared/http-errors";
import { GetPackageHandler } from "./detail/detail.handler";
import { GetPackageParams, GetPackageParamsSchema, GetPackageResponseSchema } from "./detail/detail.schema";
import { GetDocHandler } from "./docs/docs.handler";
import { GetDocParams, GetDocParamsSchema, GetDocResponseSchema } from "./docs/docs.schema";
import { ListPackagesHandler } from "./list/list.handler";
import { ListPackagesQuery, ListPackagesQuerySchema, ListPackagesResponseSchema } from "./list/list.schema";

// DocCategory Validation Schemas
const CategorySchema = Type.Object({
  id: Type.String(),
  groupId: Type.String(),
  title: Type.String(),
  slug: Type.String(),
  displayOrder: Type.Number(),
});

const CreateCategoryRequestSchema = Type.Object({
  title: Type.String(),
  slug: Type.String(),
  displayOrder: Type.Optional(Type.Number()),
});

const UpdateCategoryRequestSchema = Type.Object({
  title: Type.String(),
  slug: Type.String(),
  displayOrder: Type.Optional(Type.Number()),
});

// Doc Validation Schemas
const DocSchema = Type.Object({
  id: Type.String(),
  groupId: Type.String(),
  categoryId: Type.Union([Type.String(), Type.Null()]),
  slug: Type.String(),
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  filePath: Type.Union([Type.String(), Type.Null()]),
  content: Type.String(),
  displayOrder: Type.Number(),
  isPublished: Type.Boolean(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

const PackageItemSchema = Type.Object({
  id: Type.String(),
  groupId: Type.String(),
  slug: Type.String(),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  nugetUrl: Type.Union([Type.String(), Type.Null()]),
  npmUrl: Type.Union([Type.String(), Type.Null()]),
  githubUrl: Type.Union([Type.String(), Type.Null()]),
  latestVersion: Type.String(),
  isActive: Type.Boolean(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

const CreatePackageItemRequestSchema = Type.Object({
  slug: Type.String(),
  name: Type.String(),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  nugetUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  npmUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  githubUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  latestVersion: Type.Optional(Type.String()),
  isActive: Type.Optional(Type.Boolean()),
});

const UpdatePackageItemRequestSchema = Type.Object({
  groupId: Type.String(),
  slug: Type.String(),
  name: Type.String(),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  nugetUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  npmUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  githubUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  latestVersion: Type.Optional(Type.String()),
  isActive: Type.Optional(Type.Boolean()),
});

const CreateDocRequestSchema = Type.Object({
  title: Type.String(),
  slug: Type.String(),
  categoryId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  filePath: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  content: Type.Optional(Type.String()),
  displayOrder: Type.Optional(Type.Number()),
  isPublished: Type.Optional(Type.Boolean()),
});

const UpdateDocRequestSchema = Type.Object({
  title: Type.String(),
  slug: Type.String(),
  categoryId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  filePath: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  content: Type.Optional(Type.String()),
  displayOrder: Type.Optional(Type.Number()),
  isPublished: Type.Optional(Type.Boolean()),
});

type CreateDocRequest = Static<typeof CreateDocRequestSchema>;
type UpdateDocRequest = Static<typeof UpdateDocRequestSchema>;
type CreatePackageItemRequest = Static<typeof CreatePackageItemRequestSchema>;
type UpdatePackageItemRequest = Static<typeof UpdatePackageItemRequestSchema>;

export async function packagesRoutes(app: FastifyInstance) {
  const createHandler = container.resolve(CreatePackageHandler);
  const listAdminHandler = container.resolve(ListAdminPackagesHandler);
  const getAdminHandler = container.resolve(GetAdminPackageHandler);
  const updateHandler = container.resolve(UpdatePackageHandler);
  const deleteHandler = container.resolve(DeletePackageHandler);
  const getPublicPackageHandler = container.resolve(GetPackageHandler);
  const getPublicDocHandler = container.resolve(GetDocHandler);
  const listPublicPackagesHandler = container.resolve(ListPackagesHandler);

  // --- NuGet Package Operations ---

  app.post<{ Body: CreatePackageRequest }>("/dashboard", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Create a new NuGet package",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      body: CreatePackageRequestSchema,
      response: { 200: PackageResponseSchema, 401: ErrorResponseSchema },
    },
  }, (request) => createHandler.handle(request));

  app.get<{ Querystring: ListAdminPackagesQuery }>("/dashboard", {
    preHandler: app.requireAdmin,
    schema: {
      description: "List NuGet packages for dashboard",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      querystring: ListAdminPackagesQuerySchema,
      response: { 200: ListAdminPackagesResponseSchema, 401: ErrorResponseSchema },
    },
  }, (request) => listAdminHandler.handle(request));

  app.get<{ Params: GetAdminPackageParams }>("/dashboard/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Get package details for dashboard",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: GetAdminPackageParamsSchema,
      response: { 200: GetAdminPackageResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => getAdminHandler.handle(request));

  app.put<{ Params: UpdatePackageParams; Body: UpdatePackageRequest }>("/dashboard/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Update an existing NuGet package",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: UpdatePackageParamsSchema,
      body: UpdatePackageRequestSchema,
      response: { 200: UpdatePackageResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => updateHandler.handle(request));

  app.delete<{ Params: DeletePackageParams }>("/dashboard/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Delete a NuGet package",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: DeletePackageParamsSchema,
      response: { 200: DeletePackageResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => deleteHandler.handle(request));

  // --- Child Package Operations ---

  app.get<{ Params: { groupId: string } }>("/dashboard/:groupId/package-items", {
    preHandler: app.requireAdmin,
    schema: {
      description: "List packages inside a package group",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ groupId: Type.String() }),
      response: { 200: Type.Array(PackageItemSchema), 401: ErrorResponseSchema },
    },
  }, async (request) => {
    const packagesRepo = container.resolve<IPackagesRepository>(PACKAGES_REPOSITORY);
    const rows = await packagesRepo.listPackageItems(request.params.groupId);
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  });

  app.post<{ Params: { groupId: string }; Body: CreatePackageItemRequest }>("/dashboard/:groupId/package-items", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Create a package inside a package group",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ groupId: Type.String() }),
      body: CreatePackageItemRequestSchema,
      response: { 200: PackageItemSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema, 409: ErrorResponseSchema },
    },
  }, async (request) => {
    const packagesRepo = container.resolve<IPackagesRepository>(PACKAGES_REPOSITORY);
    const { groupId } = request.params;
    const body = request.body;

    const group = await packagesRepo.findById(groupId);
    if (!group) {
      throw new NotFoundError("err_package_not_found");
    }

    const existing = await packagesRepo.findPackageItemBySlug(body.slug);
    if (existing) {
      throw new ConflictError("err_slug_already_exists");
    }

    const row = await packagesRepo.createPackageItem({
      groupId,
      slug: body.slug,
      name: body.name,
      description: body.description ?? null,
      nugetUrl: body.nugetUrl ?? null,
      npmUrl: body.npmUrl ?? null,
      githubUrl: body.githubUrl ?? null,
      latestVersion: body.latestVersion ?? "1.0.0",
      isActive: body.isActive ?? true,
    });

    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });

  app.put<{ Params: { id: string }; Body: UpdatePackageItemRequest }>("/dashboard/package-items/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Update a package inside a package group",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String() }),
      body: UpdatePackageItemRequestSchema,
      response: { 200: PackageItemSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema, 409: ErrorResponseSchema },
    },
  }, async (request) => {
    const packagesRepo = container.resolve<IPackagesRepository>(PACKAGES_REPOSITORY);
    const { id } = request.params;
    const body = request.body;

    const current = await packagesRepo.findPackageItemById(id);
    if (!current) {
      throw new NotFoundError("err_package_not_found");
    }

    const group = await packagesRepo.findById(body.groupId);
    if (!group) {
      throw new NotFoundError("err_package_not_found");
    }

    if (body.slug !== current.slug) {
      const existing = await packagesRepo.findPackageItemBySlug(body.slug);
      if (existing && existing.id !== id) {
        throw new ConflictError("err_slug_already_exists");
      }
    }

    const row = await packagesRepo.updatePackageItem(id, {
      groupId: body.groupId,
      slug: body.slug,
      name: body.name,
      description: body.description ?? null,
      nugetUrl: body.nugetUrl ?? null,
      npmUrl: body.npmUrl ?? null,
      githubUrl: body.githubUrl ?? null,
      latestVersion: body.latestVersion ?? "1.0.0",
      isActive: body.isActive ?? true,
      updatedAt: new Date(),
    });

    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });

  app.get<{ Params: { id: string } }>("/dashboard/package-items/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Get a package inside a package group",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String() }),
      response: { 200: PackageItemSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, async (request) => {
    const packagesRepo = container.resolve<IPackagesRepository>(PACKAGES_REPOSITORY);
    const row = await packagesRepo.findPackageItemById(request.params.id);
    if (!row) {
      throw new NotFoundError("err_package_not_found");
    }

    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });

  app.delete<{ Params: { id: string } }>("/dashboard/package-items/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Delete a package inside a package group",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String() }),
      response: { 200: Type.Object({ success: Type.Boolean() }), 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, async (request) => {
    const packagesRepo = container.resolve<IPackagesRepository>(PACKAGES_REPOSITORY);
    const item = await packagesRepo.findPackageItemById(request.params.id);
    if (!item) {
      throw new NotFoundError("err_package_not_found");
    }

    await packagesRepo.deletePackageItem(request.params.id);
    return { success: true };
  });

  // --- DocCategory Operations ---

  app.get<{ Params: { packageId: string } }>("/dashboard/:packageId/categories", {
    preHandler: app.requireAdmin,
    schema: {
      description: "List categories for a package",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ packageId: Type.String() }),
      response: { 200: Type.Array(CategorySchema), 401: ErrorResponseSchema },
    },
  }, async (request) => {
    const packagesRepo = container.resolve<IPackagesRepository>(PACKAGES_REPOSITORY);
    return packagesRepo.listCategories(request.params.packageId);
  });

  app.post<{ Params: { packageId: string }; Body: { title: string; slug: string; displayOrder?: number } }>("/dashboard/:packageId/categories", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Create a new category for a package",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ packageId: Type.String() }),
      body: CreateCategoryRequestSchema,
      response: { 200: CategorySchema, 401: ErrorResponseSchema, 409: ErrorResponseSchema },
    },
  }, async (request) => {
    const packagesRepo = container.resolve<IPackagesRepository>(PACKAGES_REPOSITORY);
    const { packageId } = request.params;
    const body = request.body;

    const existing = await packagesRepo.findCategoryBySlug(packageId, body.slug);
    if (existing) {
      throw new ConflictError("err_slug_already_exists");
    }

    return packagesRepo.createCategory({
      groupId: packageId,
      title: body.title,
      slug: body.slug,
      displayOrder: body.displayOrder ?? 0,
    });
  });

  app.put<{ Params: { id: string }; Body: { title: string; slug: string; displayOrder?: number } }>("/dashboard/categories/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Update a category",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String() }),
      body: UpdateCategoryRequestSchema,
      response: { 200: CategorySchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema, 409: ErrorResponseSchema },
    },
  }, async (request) => {
    const packagesRepo = container.resolve<IPackagesRepository>(PACKAGES_REPOSITORY);
    const { id } = request.params;
    const body = request.body;

    const category = await packagesRepo.findCategoryById(id);
    if (!category) {
      throw new NotFoundError("err_category_not_found");
    }

    if (body.slug !== category.slug) {
      const existing = await packagesRepo.findCategoryBySlug(category.groupId, body.slug);
      if (existing && existing.id !== id) {
        throw new ConflictError("err_slug_already_exists");
      }
    }

    return packagesRepo.updateCategory(id, {
      title: body.title,
      slug: body.slug,
      displayOrder: body.displayOrder ?? 0,
    });
  });

  app.delete<{ Params: { id: string } }>("/dashboard/categories/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Delete a category",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String() }),
      response: { 200: Type.Object({ success: Type.Boolean() }), 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, async (request) => {
    const packagesRepo = container.resolve<IPackagesRepository>(PACKAGES_REPOSITORY);
    const { id } = request.params;

    const category = await packagesRepo.findCategoryById(id);
    if (!category) {
      throw new NotFoundError("err_category_not_found");
    }

    await packagesRepo.deleteCategory(id);
    return { success: true };
  });

  // --- Doc Operations ---

  app.get<{ Params: { packageId: string } }>("/dashboard/:packageId/docs", {
    preHandler: app.requireAdmin,
    schema: {
      description: "List docs for a package",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ packageId: Type.String() }),
      response: { 200: Type.Array(DocSchema), 401: ErrorResponseSchema },
    },
  }, async (request) => {
    const packagesRepo = container.resolve<IPackagesRepository>(PACKAGES_REPOSITORY);
    const rows = await packagesRepo.listDocs(request.params.packageId);
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  });

  app.post<{ Params: { packageId: string }; Body: CreateDocRequest }>("/dashboard/:packageId/docs", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Create a new doc for a package",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ packageId: Type.String() }),
      body: CreateDocRequestSchema,
      response: { 200: DocSchema, 401: ErrorResponseSchema, 409: ErrorResponseSchema },
    },
  }, async (request) => {
    const packagesRepo = container.resolve<IPackagesRepository>(PACKAGES_REPOSITORY);
    const { packageId } = request.params;
    const body = request.body;

    const existing = await packagesRepo.findDocBySlug(packageId, body.slug);
    if (existing) {
      throw new ConflictError("err_slug_already_exists");
    }

    const row = await packagesRepo.createDoc({
      groupId: packageId,
      categoryId: body.categoryId ?? null,
      title: body.title,
      slug: body.slug,
      description: body.description ?? null,
      filePath: body.filePath ?? null,
      content: body.content ?? "",
      displayOrder: body.displayOrder ?? 0,
      isPublished: body.isPublished ?? true,
    });

    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });

  app.get<{ Params: { id: string } }>("/dashboard/docs/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Get doc detail",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String() }),
      response: { 200: DocSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, async (request) => {
    const packagesRepo = container.resolve<IPackagesRepository>(PACKAGES_REPOSITORY);
    const row = await packagesRepo.findDocById(request.params.id);
    if (!row) {
      throw new NotFoundError("err_doc_not_found");
    }
    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });

  app.put<{ Params: { id: string }; Body: UpdateDocRequest }>("/dashboard/docs/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Update a doc",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String() }),
      body: UpdateDocRequestSchema,
      response: { 200: DocSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema, 409: ErrorResponseSchema },
    },
  }, async (request) => {
    const packagesRepo = container.resolve<IPackagesRepository>(PACKAGES_REPOSITORY);
    const { id } = request.params;
    const body = request.body;

    const doc = await packagesRepo.findDocById(id);
    if (!doc) {
      throw new NotFoundError("err_doc_not_found");
    }

    if (body.slug !== doc.slug) {
      const existing = await packagesRepo.findDocBySlug(doc.groupId, body.slug);
      if (existing && existing.id !== id) {
        throw new ConflictError("err_slug_already_exists");
      }
    }

    const row = await packagesRepo.updateDoc(id, {
      categoryId: body.categoryId ?? null,
      title: body.title,
      slug: body.slug,
      description: body.description ?? null,
      filePath: body.filePath ?? null,
      content: body.content ?? "",
      displayOrder: body.displayOrder ?? 0,
      isPublished: body.isPublished ?? true,
      updatedAt: new Date(),
    });

    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });

  app.delete<{ Params: { id: string } }>("/dashboard/docs/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Delete a doc",
      tags: ["Packages"],
      security: [{ bearerAuth: [] }],
      params: Type.Object({ id: Type.String() }),
      response: { 200: Type.Object({ success: Type.Boolean() }), 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, async (request) => {
    const packagesRepo = container.resolve<IPackagesRepository>(PACKAGES_REPOSITORY);
    const { id } = request.params;

    const doc = await packagesRepo.findDocById(id);
    if (!doc) {
      throw new NotFoundError("err_doc_not_found");
    }

    await packagesRepo.deleteDoc(id);
    return { success: true };
  });

  // --- Public Guest Operations ---

  app.get<{ Params: GetPackageParams }>("/:slug", {
    schema: {
      description: "Get public package by slug",
      tags: ["Packages"],
      params: GetPackageParamsSchema,
      response: { 200: GetPackageResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => getPublicPackageHandler.handle(request));

  app.get<{ Params: GetDocParams }>("/:slug/docs/:docSlug", {
    schema: {
      description: "Get public package documentation page",
      tags: ["Packages"],
      params: GetDocParamsSchema,
      response: { 200: GetDocResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => getPublicDocHandler.handle(request));

  app.get<{ Querystring: ListPackagesQuery }>("/", {
    schema: {
      description: "List public active packages",
      tags: ["Packages"],
      querystring: ListPackagesQuerySchema,
      response: { 200: ListPackagesResponseSchema },
    },
  }, (request) => listPublicPackagesHandler.handle(request));
}
