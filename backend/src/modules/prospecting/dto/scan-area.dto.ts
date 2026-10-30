import { IsString, IsNotEmpty, IsNumber, IsOptional, ValidateNested, IsArray, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CenterCoordinatesDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class ScanAreaDto {
  @IsString()
  @IsNotEmpty()
  sector!: string;

  @ValidateNested()
  @Type(() => CenterCoordinatesDto)
  center!: CenterCoordinatesDto;

  @IsNumber()
  @Min(0.5)
  @Max(50)
  radiusKm!: number;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  country?: string = 'Mexico';

  @IsArray()
  @IsOptional()
  polygon?: [number, number][]; // Optional custom polygon coords [[lat, lng], ...]
}

