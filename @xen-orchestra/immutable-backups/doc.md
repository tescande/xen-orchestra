# Imutability

the goal is to make a remote that XO can write, but not modify during the immutability duration set on the remote. That way, it's not possible for XO to delete or crypt any backup during this period. It protects your backup agains ransomware, at least as long as the attacker does not have a root access to the remote server.

We target `governance` type of immutability, **the local root account of the remote server will be able to lift immutability**.

We use the file system capabilities, they are tested on the protection process start.

It is compatible with encryption at rest made by XO.
The `protect` and `lift` processes must be run as root on the remote. On start, the protect process write into the remote `metadata.json` file its status (last protection applied, last protection lifted)

## Configuring

this package uses app-conf to store its config. The application name id `immutable-backup`

## Making a file immutable

Creates a `.immutable` folder at the root of the remote if it does not exist

when marking a file or a folder immutable, it create an alias file in `.immutable` containing the path to the folder/file and make this file also immutable.

The watchin process

## Lifting a file immutability

- check the file in the `.immutable` folder
- if the file is old enough
  - if this file is already mutable
    - if the last tentative of immutbaility lifting is older than 1 day
      - relaunch it
      - append the date to file
  - if not
    - make this file mutable ( append only)
    - append the starting date of the immutability lifting process
  - make the target mutable
  - delete the alias file
- else : do not lift protection

## Protecting XO backup

- Watch the `xo-config-backups` for new folders
- for each new the `xo-config-backups`folder
  - register a watcher
  - wait for the json file
  - make the folder immutable
  - unregister the watcher

## Protecting Pool metadata backup

- Watch the `xo-pool-metadata-backups` for new folders
- for each new the `xo-pool-metadata-backups`folder
  - register a watcher
  - wait for the json file
  - make the folder immutable
  - unregister the watcher

## Protecting VM backups

- Watch the `xo-vm-backups` for new VM
- Watch all the `xo-vm-backups/<vm uuid>` for new full backup and new metadata of backups
- Make any non dot `*.json`, `*.xva`, `*.xva.checksum` in `xo-vm-backups/<vm uuid>/` immutable on creation

### Full backup jobs

xva are uploaded as a dot files and renamed. They are already handled by the watcher.

### Incremental backup jobs

- Watch all the `xo-vm-backups/<vm uuid>/vdis` creation
- Watch all the `xo-vm-backups/<vm uuid>/vdis` sub folders for new job id
- Watch all the `xo-vm-backups/<vm uuid>/vdis/<job uuid>/` sub folders for new job vdis
- Watch all the `xo-vm-backups/<vm uuid>/vdis/<job uuid>/<vdi uuid>` sub folders for new vhd and alias.vhd file, ignoring dot files
- Watch all the `xo-vm-backups/<vm uuid>/vdis/<job uuid>/<vdi uuid>/data` (only for increme)

Make any new file in `xo-vm-backups/<vm uuid>/vdis/<job uuid>/<vdi uuid>` immutable

#### vhd files

the vhd files are uploaded to a dot file, and renamed on success. They are already handled by the watcher.

#### vhd blocks

- when a new folder is created in `xo-vm-backups/<vm uuid>/vdis/<job uuid>/<vdi uuid>/data`
  - register a watcher of this folder `xo-vm-backups/<vm uuid>/vdis/<job uuid>/<vdi uuid>/data/<uuid>`
  - wait for the bat/footer and header, then make the folder immutable recursively
  - stop watching `xo-vm-backups/<vm uuid>/vdis/<job uuid>/<vdi uuid>/data/<uuid>`
- alias are already handled by the watcher

## Releasing protection on old enough files on a remote

the `lift` process will list the files old enough in the `.immutability` folder and apply the individual lifting process

This process should be run at least once a day.

## Troubleshooting

### some files are still locked

launch the `lift` cli with `--no-cache`. This will do a fill filesystem traversal, and can be resource heavy, but will unlock all file based on their creation date.

### make remote fully mutable again

- Update the immutability setting with a 0 duration
- launch the `lift` cli.
- remove the `protect` service

### increasing the immutability duration

this will prolong immutable file, but won't protect files that are already out of immutability

### reducing the immutability duration

change the setting, and launch the `lift` cli , or wait for next planed execution

### why my incremental backup are not marked as protected in XO ?

to protect an incremental backup, all the chain must be under protection . To ensure at least 7 days of backups are protected, you need to set the immutability duration and retention at 14 days, the full backup interval at 7 days

That means that if the last backup chain is cmplete ( 7 backup ) it is completly under protection, and if not, the precedent chain is also under protection. K are key backups, and d are delta

```
Kd Kdddddd Kdddddd K #  8 backups protected, 2 chains
K Kdddddd Kdddddd Kd #  9 backups protected, 2 chains
 Kdddddd Kdddddd Kdd # 10 backups protected, 2 chains
 Kddddd Kdddddd Kddd # 11 backups protected, 2 chains
 Kdddd Kdddddd Kdddd # 12 backups protected, 2 chains
 Kddd Kdddddd Kddddd # 13 backups protected, 2 chains
 Kdd Kdddddd Kdddddd #  7 backups protected, 1 chain since precedent full is now mutable
Kd Kdddddd Kdddddd K #  8 backups protected, 2 chains
```

### Why does the protect process don't to start

- it should be run as root
- the underlying file system should support immutability
- logs are in journalctl
