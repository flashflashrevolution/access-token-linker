import
{
    Entity,
    PrimaryGeneratedColumn,
    Column
} from "typeorm";

import { String } from 'typescript-string-operations';

@Entity({ name: "patreon_links" })
export class PatreonLink
{
    @PrimaryGeneratedColumn()
    id!: number;

    @Column(
        {
            default: String.Empty,
            type: "text",
            charset: "utf8"
        })
    access_token!: string;

    @Column(
        {
            type: "int",
            unsigned: true,
            width: 10,
            default: 0,
            unique: true
        })
    ffr_userid!: number;
}
