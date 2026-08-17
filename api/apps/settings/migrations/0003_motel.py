from django.db import migrations, models
from django.utils.text import slugify


def fill_slugs(apps, schema_editor):
    Motel = apps.get_model("settings", "Motel")
    for identifier, name in Motel.objects.values_list("pk", "name"):
        slug = slugify(name)[:120] or f"motel-{identifier}"
        Motel.objects.filter(pk=identifier).update(slug=slug)


class Migration(migrations.Migration):
    dependencies = [
        ("settings", "0002_seed_business_profile"),
        ("users", "0002_alter_user_employee_number_alter_user_last_login_ip_and_more"),
    ]

    operations = [
        migrations.RenameModel(old_name="BusinessProfile", new_name="Motel"),
        migrations.AlterModelOptions(
            name="motel",
            options={
                "ordering": ("name",),
                "verbose_name": "Motel",
                "verbose_name_plural": "Moteles",
                "base_manager_name": "all_objects",
            },
        ),
        migrations.AddField(
            model_name="motel",
            name="slug",
            field=models.SlugField(
                default="motel", max_length=140, unique=True, verbose_name="Identificador"
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="motel",
            name="is_active",
            field=models.BooleanField(db_index=True, default=True, verbose_name="Vigente"),
        ),
        migrations.AddField(
            model_name="motel",
            name="deleted_at",
            field=models.DateTimeField(
                blank=True, editable=False, null=True, verbose_name="Desactivado en"
            ),
        ),
        migrations.AddField(
            model_name="motel",
            name="deletion_reason",
            field=models.CharField(blank=True, max_length=255, verbose_name="Motivo de baja"),
        ),
        migrations.AddField(
            model_name="motel",
            name="deleted_by",
            field=models.ForeignKey(
                blank=True,
                editable=False,
                null=True,
                on_delete=models.PROTECT,
                related_name="+",
                to="users.user",
                verbose_name="Desactivado por",
            ),
        ),
        migrations.RunPython(fill_slugs, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="motel",
            name="name",
            field=models.CharField(max_length=120, verbose_name="Nombre comercial"),
        ),
    ]
