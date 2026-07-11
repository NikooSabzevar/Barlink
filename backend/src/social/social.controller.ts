import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SocialService } from './social.service';

@Controller('social')
export class SocialController {
  constructor(private social: SocialService) {}

  @Get('profile/:userId')
  getProfile(@Param('userId') userId: string) {
    return this.social.getProfile(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('profile')
  upsertProfile(
    @Request() req: any,
    @Body() body: { photoUrl?: string; bio?: string; gender?: string; age?: number; openToChat?: boolean },
  ) {
    return this.social.upsertProfile(req.user.id, body);
  }

  @Get('lounge/:barId')
  getLoungeUsers(@Param('barId') barId: string) {
    return this.social.getLoungeUsers(barId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('messages')
  sendMessage(
    @Request() req: any,
    @Body() body: { barId: string; receiverId: string; message: string },
  ) {
    return this.social.sendMessage(req.user.id, body.barId, body.receiverId, body.message);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('messages/inbox')
  getInbox(@Request() req: any) {
    return this.social.getInbox(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('messages/thread/:otherUserId/:barId')
  getThread(
    @Request() req: any,
    @Param('otherUserId') otherUserId: string,
    @Param('barId') barId: string,
  ) {
    return this.social.getThread(req.user.id, otherUserId, barId);
  }
}
