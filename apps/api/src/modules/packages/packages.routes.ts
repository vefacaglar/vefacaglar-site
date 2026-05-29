import { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
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

// DocCategory Validation Schemas
const CategorySchema = Type.Object({
  id: Type.String(),
  packageId: Type.String(),
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
  packageId: Type.String(),
  categoryId: Type.Union([Type.String(), Type.Null()]),
  slug: Type.String(),
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  filePath: Type.String(),
  displayOrder: Type.Number(),
  isPublished: Type.Boolean(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

const CreateDocRequestSchema = Type.Object({
  title: Type.String(),
  slug: Type.String(),
  categoryId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  filePath: Type.String(),
  displayOrder: Type.Optional(Type.Number()),
  isPublished: Type.Optional(Type.Boolean()),
});

const UpdateDocRequestSchema = Type.Object({
  title: Type.String(),
  slug: Type.String(),
  categoryId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  filePath: Type.String(),
  displayOrder: Type.Optional(Type.Number()),
  isPublished: Type.Optional(Type.Boolean()),
});

export async function packagesRoutes(app: FastifyInstance) {
  const createHandler = container.resolve(CreatePackageHandler);
  const listAdminHandler = container.resolve(ListAdminPackagesHandler);
  const getAdminHandler = container.resolve(GetAdminPackageHandler);
  const updateHandler = container.resolve(UpdatePackageHandler);
  const deleteHandler = container.resolve(DeletePackageHandler);

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
      packageId,
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
      const existing = await packagesRepo.findCategoryBySlug(category.packageId, body.slug);
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

  app.post<{ Params: { packageId: string }; Body: { title: string; slug: string; categoryId?: string | null; description?: string | null; filePath: string; displayOrder?: number; isPublished?: boolean } }>("/dashboard/:packageId/docs", {
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
      packageId,
      categoryId: body.categoryId ?? null,
      title: body.title,
      slug: body.slug,
      description: body.description ?? null,
      filePath: body.filePath,
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

  app.put<{ Params: { id: string }; Body: { title: string; slug: string; categoryId?: string | null; description?: string | null; filePath: string; displayOrder?: number; isPublished?: boolean } }>("/dashboard/docs/:id", {
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
      const existing = await packagesRepo.findDocBySlug(doc.packageId, body.slug);
      if (existing && existing.id !== id) {
        throw new ConflictError("err_slug_already_exists");
      }
    }

    const row = await packagesRepo.updateDoc(id, {
      categoryId: body.categoryId ?? null,
      title: body.title,
      slug: body.slug,
      description: body.description ?? null,
      filePath: body.filePath,
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
}
