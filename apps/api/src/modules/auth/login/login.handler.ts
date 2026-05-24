import { LoginRequest, LoginResponse } from "./login.schema";
import { injectable } from "tsyringe";
import { AuthService } from "../auth.service";

@injectable()
export class LoginHandler {
  constructor(private readonly authService: AuthService) {}

  async handle(request: LoginRequest): Promise<LoginResponse> {
    return this.authService.login(request.email, request.password);
  }
}
