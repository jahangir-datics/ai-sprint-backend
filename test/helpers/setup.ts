import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface TestContext {
  app: INestApplication<App>;
  prisma: PrismaService;
  accessToken: string;
}

export async function setupTestApp(testUser: {
  email: string;
  password: string;
  name: string;
}): Promise<TestContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  const prisma = app.get(PrismaService);

  await request(app.getHttpServer()).post('/auth/register').send(testUser);
  const loginRes = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: testUser.email, password: testUser.password }); // NOSONAR

  return {
    app,
    prisma,
    accessToken: loginRes.body.data.accessToken,
  };
}
