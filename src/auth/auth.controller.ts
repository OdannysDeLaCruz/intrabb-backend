import { Controller, Post, HttpCode, HttpStatus, Get, Req, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { RequestWithPlatform } from '../common/middleware/platform.middleware';
import { Public } from '../common/decorators/public.decorator';
import { SkipPlatform } from '../common/decorators/skip-platform.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  
  @Post('phone-exists')
  @HttpCode(HttpStatus.OK)
  @Public()
  @SkipPlatform()
  async phoneExists(@Body() body: { phone: string }) {
    const { user } = await this.authService.getUserByPhone(body.phone)
    // console.log('exist user', user)
    return { exists: user ? true : false }
  }

  @Post('sign-up')
  async signUp(@Body() body: CreateUserDto, @Req() req: RequestWithPlatform) {
    // console.log('SIGN UP', body)
    try {
      return await this.authService.signUpOrSignIn(body, req.platform)
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Get('me')
  async me(@Req() req: RequestWithPlatform) {
    const userId = req.user?.id
    return await this.authService.getCurrentUser(userId, req.platform)
  }

  @Post('complete-profile')
  async completeProfile(@Req() req: any, @Body() body: any) {
    const userId = req.user?.id || req.user?.user_id
    return await this.authService.updateUserProfile(userId, body)
  }

  @Post('create-intrabbler-from-website')
  @Public()
  @SkipPlatform()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'fotoPerfil', maxCount: 1 },
      { name: 'fotoCedula', maxCount: 1 },
      { name: 'camaraComercio', maxCount: 1 }
    ],
    {
      limits: {
        fileSize: 1024 * 1024 * 5 // 5MB limit
      },
      fileFilter: (req: any, file, callback) => {
        // Guardar información del archivo en el request para acceder en caso de error
        if (!req.uploadedFileInfo) {
          req.uploadedFileInfo = {};
        }
        req.uploadedFileInfo[file.fieldname] = {
          originalname: file.originalname
        };
        callback(null, true);
      }
    }
    )
  )
  async createIntrabblerFromWebsite(
    @Body() body: any,
    @UploadedFiles() files: {
      fotoPerfil?: Express.Multer.File[];
      fotoCedula?: Express.Multer.File[];
      camaraComercio?: Express.Multer.File[];
    }
  ) {
    // console.log('SIGN UP FROM WEBSITE', body)
    // Combine body and files into a single object
    const registrationData = {
      ...body,
      files
    };

    return await this.authService.CreateIntrabblerFromWebsite(registrationData)
  }
}
