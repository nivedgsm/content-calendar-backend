import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, LogoutDto, RefreshTokenDto, RegisterDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.auth.register(body.name, body.email, body.password, body.agencyName);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshTokenDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  logout(@Body() body: LogoutDto = {}) {
    return this.auth.logout(body.refreshToken);
  }
}
