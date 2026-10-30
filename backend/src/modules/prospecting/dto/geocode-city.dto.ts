import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GeocodeCityDto {
  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  country?: string = 'Mexico';
}

